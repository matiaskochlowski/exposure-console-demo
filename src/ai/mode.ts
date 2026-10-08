import type { AssistRequest } from '../shared/assist.ts';
import type { Finding } from '../shared/finding.ts';
import type { StreamEvent } from '../shared/stream.ts';
import { createHttpProvider, ProviderUnavailableError } from './httpProvider.ts';
import { createMockProvider } from './mockProvider.ts';
import type { AssistantProvider } from './provider.ts';

export type AiMode = 'mock' | 'live';

export function configuredMode(value: string | undefined = import.meta.env.VITE_AI_MODE): AiMode {
  return value === 'live' ? 'live' : 'mock';
}

/**
 * Live mode with a narrow fallback: only a recognised `503 provider_unavailable` received BEFORE any
 * event switches to the mock (start.mode tells the UI). Auth, rate-limit and mid-stream failures are
 * surfaced as errors, never papered over with scripted text.
 */
export function withMockFallback(
  live: AssistantProvider,
  mock: AssistantProvider,
): AssistantProvider {
  return {
    mode: 'live',
    async *stream(request: AssistRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
      try {
        yield* live.stream(request, signal);
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) throw error;
        yield* mock.stream(request, signal);
      }
    },
  };
}

export function createProvider(
  mode: AiMode,
  getFinding: (id: string) => Finding | undefined,
): AssistantProvider {
  const mock = createMockProvider(getFinding);
  return mode === 'live' ? withMockFallback(createHttpProvider(), mock) : mock;
}
