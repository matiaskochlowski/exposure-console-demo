import Anthropic from '@anthropic-ai/sdk';
import { buildFindingContext } from '../src/shared/assist.js';
import { findFindingById } from '../src/shared/generate.js';
import { runAnalyst, sdkStreamFactory, toErrorEvent } from './_lib/claude.js';
import { jsonError, parseAssist, readJson, rejection, sseResponse } from './_lib/http.js';

/** Live mode needs an explicit opt-in as well as a key, so a key added to a preview doesn't open it. */
export function liveEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.LIVE_ANALYST_ENABLED === '1';
}

/**
 * POST /api/assist — streams one analyst turn as SSE (see src/shared/stream.ts).
 * When live mode is not enabled it answers 503 provider_unavailable before streaming, which is the
 * only case the client is allowed to fall back to the mock analyst.
 *
 * Not yet done (Release 2 gate before enabling live mode on a public URL): authentication and a
 * durable rate limit. See docs/security-ai.md.
 */
export async function POST(request: Request): Promise<Response> {
  if (!liveEnabled()) {
    return jsonError(
      503,
      'provider_unavailable',
      'Live analyst is not enabled on this deployment.',
    );
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    return rejection(error);
  }
  const parsed = parseAssist(body);
  if (!parsed.success) return jsonError(400, 'invalid_request', 'Invalid request.');

  // The server looks the finding up itself; clients cannot submit records of their own.
  const finding = findFindingById(parsed.data.findingId);
  if (!finding) return jsonError(404, 'invalid_request', 'Unknown finding.');
  const context = buildFindingContext(finding, parsed.data.clientState);

  const started = Date.now();
  // One attempt within the 30 s function limit (vercel.json), so a timeout surfaces as a `timeout`
  // event instead of the platform killing the stream mid-retry.
  const client = new Anthropic({ maxRetries: 0, timeout: 25_000 });
  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort(), { once: true });
  const events = runAnalyst(parsed.data, context, sdkStreamFactory(client), abort.signal);
  return sseResponse(
    events,
    (error) => {
      // Log identifiers and outcomes only: never prompts, scanner text or model output.
      console.error(
        JSON.stringify({
          requestId: parsed.data.requestId,
          findingId: parsed.data.findingId,
          ms: Date.now() - started,
          error:
            error instanceof Anthropic.APIError
              ? `api_${error.status}`
              : abort.signal.aborted
                ? 'aborted'
                : 'internal',
        }),
      );
      return abort.signal.aborted ? null : toErrorEvent(parsed.data.requestId, error);
    },
    () => abort.abort(),
  );
}

export function GET(): Response {
  return jsonError(405, 'invalid_request', 'Use POST.');
}
