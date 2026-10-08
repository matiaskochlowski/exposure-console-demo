import { z } from 'zod';
import { actionCallSchema } from './actions.js';

/** Wire protocol between the assistant providers and the UI (SSE frames, one JSON event each). */
export const ERROR_CODES = [
  'provider_unavailable',
  'unauthorized',
  'rate_limited',
  'invalid_request',
  'invalid_tool',
  'provider_error',
  'timeout',
  'truncated',
  'network',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const requestId = z.string().min(8).max(64);

export const streamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('start'), requestId, mode: z.enum(['mock', 'live']) }),
  z.strictObject({ type: z.literal('text'), requestId, delta: z.string().max(4000) }),
  z.strictObject({
    type: z.literal('tool_proposal'),
    requestId,
    proposalId: z.string().min(4).max(64),
    call: actionCallSchema,
  }),
  z.strictObject({
    type: z.literal('error'),
    requestId,
    code: z.enum(ERROR_CODES),
    message: z.string().max(500),
    retryable: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('done'),
    requestId,
    reason: z.enum(['end_turn', 'max_tokens', 'aborted']),
  }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

export function encodeSse(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Incremental SSE parser: feed() arbitrary chunks (frames may be split anywhere, including inside a
 * multi-byte character when used with TextDecoder streaming). Frames that are not valid events are
 * reported through onInvalid rather than thrown, so one bad frame cannot crash the UI.
 */
export function createSseParser(
  onEvent: (event: StreamEvent) => void,
  onInvalid: (raw: string) => void,
) {
  let buffer = '';
  const flushFrame = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) return; // comments / keep-alives
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      onInvalid(data);
      return;
    }
    const parsed = streamEventSchema.safeParse(json);
    if (parsed.success) onEvent(parsed.data);
    else onInvalid(data);
  };
  return {
    feed(chunk: string) {
      buffer += chunk;
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        flushFrame(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
    },
    /** Returns leftover bytes; a non-empty remainder at end of stream means a truncated frame. */
    end(): string {
      const rest = buffer;
      buffer = '';
      return rest.trim();
    },
  };
}
