import { z } from 'zod';
import {
  assistRequestSchema,
  buildFindingContext,
  clientStateSchema,
} from '../../src/shared/assist.js';
import { findFindingById } from '../../src/shared/generate.js';
import { encodeSse, type ErrorCode, type StreamEvent } from '../../src/shared/stream.js';

export function jsonError(status: number, code: ErrorCode, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export class RequestRejected extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Boundary checks before any parsing: JSON content type only (so a cross-site "simple" text/plain
 * POST is refused), same-origin when the browser sends an Origin, and a byte limit checked against
 * Content-Length first and the actual UTF-8 size second.
 */
export async function readJson(request: Request, maxBytes = 8 * 1024): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new RequestRejected(415, 'Content-Type must be application/json.');
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new RequestRejected(403, 'Cross-origin requests are not allowed.');
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new RequestRejected(413, 'Request body is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes)
    throw new RequestRejected(413, 'Request body is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestRejected(400, 'Body must be JSON.');
  }
}

export function rejection(error: unknown): Response {
  if (error instanceof RequestRejected)
    return jsonError(error.status, 'invalid_request', error.message);
  return jsonError(400, 'invalid_request', 'Invalid request.');
}

export function parseAssist(body: unknown) {
  return assistRequestSchema.safeParse(body);
}

const previewSchema = z.strictObject({
  findingId: z.string().regex(/^DEMO-\d{4}-\d{5}$/),
  clientState: clientStateSchema.optional(),
});

/** The exact allowlisted, redacted finding context the model would receive (no model call). */
export function previewResponse(body: unknown): Response {
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid_request', 'Invalid preview request.');
  const finding = findFindingById(parsed.data.findingId);
  if (!finding) return jsonError(404, 'invalid_request', 'Unknown finding.');
  return Response.json(buildFindingContext(finding, parsed.data.clientState), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Pull-based SSE body: the model stream advances only as the client reads (backpressure), and a
 * client disconnect cancels the generator so no more tokens are requested.
 */
export function sseResponse(
  events: AsyncGenerator<StreamEvent>,
  onError: (error: unknown) => StreamEvent | null,
  onCancel: () => void = () => {},
): Response {
  const encoder = new TextEncoder();
  let finished = false;
  const close = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (finished) return;
    finished = true;
    try {
      controller.close();
    } catch {
      // already closed or cancelled
    }
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await events.next();
        if (next.done) return close(controller);
        controller.enqueue(encoder.encode(encodeSse(next.value)));
      } catch (error) {
        const event = finished ? null : onError(error);
        if (event) {
          try {
            controller.enqueue(encoder.encode(encodeSse(event)));
          } catch {
            // client went away
          }
        }
        close(controller);
      }
    },
    async cancel() {
      finished = true;
      onCancel();
      await events.return(undefined).catch(() => {});
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
