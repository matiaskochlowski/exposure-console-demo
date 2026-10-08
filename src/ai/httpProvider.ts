import type { AssistRequest } from '../shared/assist.js';
import { createSseParser, type ErrorCode, type StreamEvent } from '../shared/stream.js';
import type { AssistantProvider } from './provider.js';

export class ProviderUnavailableError extends Error {
  constructor() {
    super('Live provider unavailable');
  }
}

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'invalid_request',
  401: 'unauthorized',
  403: 'unauthorized',
  429: 'rate_limited',
};

/**
 * Streams from POST /api/assist. EventSource cannot POST a JSON body, so this reads the
 * text/event-stream response with fetch + ReadableStream and the shared incremental parser.
 */
export function createHttpProvider(
  options: { endpoint?: string; idleTimeoutMs?: number; fetchImpl?: typeof fetch } = {},
): AssistantProvider {
  const endpoint = options.endpoint ?? '/api/assist';
  const idleTimeoutMs = options.idleTimeoutMs ?? 30_000;
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  return {
    mode: 'live',
    async *stream(request: AssistRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
      const { requestId } = request;
      const local = new AbortController();
      const abort = () => local.abort();
      signal.addEventListener('abort', abort, { once: true });
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const armTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timedOut = true;
          local.abort();
        }, idleTimeoutMs);
      };
      const error = (code: ErrorCode, message: string, retryable: boolean): StreamEvent => ({
        type: 'error',
        requestId,
        code,
        message,
        retryable,
      });

      try {
        armTimer();
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify(request),
            signal: local.signal,
          });
        } catch {
          if (signal.aborted) return yield { type: 'done', requestId, reason: 'aborted' };
          if (timedOut) return yield error('timeout', 'The analyst did not respond in time.', true);
          return yield error('network', 'Could not reach the analyst service.', true);
        }

        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as {
            error?: { code?: string; message?: string };
          } | null;
          if (response.status === 503 && body?.error?.code === 'provider_unavailable')
            throw new ProviderUnavailableError();
          const code = STATUS_CODES[response.status] ?? 'provider_error';
          return yield error(
            code,
            body?.error?.message ?? `Request failed (${response.status}).`,
            code === 'rate_limited' || code === 'provider_error',
          );
        }

        const queue: StreamEvent[] = [];
        let terminal = false;
        const parser = createSseParser(
          (event) => queue.push(event),
          (raw) =>
            queue.push(
              raw.includes('"tool_proposal"')
                ? error('invalid_tool', 'Dropped a proposal that failed validation.', false)
                : error('provider_error', 'Received a malformed event.', true),
            ),
        );
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        try {
          while (!terminal) {
            let chunk: ReadableStreamReadResult<string>;
            try {
              chunk = await reader.read();
            } catch {
              break;
            }
            if (chunk.done) break;
            armTimer();
            parser.feed(chunk.value);
            while (queue.length) {
              const event = queue.shift()!;
              if (event.requestId !== requestId) continue; // never mix responses between requests
              yield event;
              if (
                event.type === 'done' ||
                (event.type === 'error' && event.code !== 'invalid_tool')
              ) {
                terminal = true;
                break;
              }
            }
          }
        } finally {
          reader.cancel().catch(() => {});
        }

        if (!terminal) {
          if (signal.aborted) yield { type: 'done', requestId, reason: 'aborted' };
          else if (timedOut) yield error('timeout', 'The analyst stopped responding.', true);
          else yield error('truncated', 'The response ended unexpectedly.', true);
        }
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    },
  };
}
