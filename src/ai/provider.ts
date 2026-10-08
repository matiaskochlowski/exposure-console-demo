import type { AssistRequest } from '../shared/assist.js';
import type { StreamEvent } from '../shared/stream.js';

export interface AssistantProvider {
  readonly mode: 'mock' | 'live';
  /**
   * Stream events for one request. Must end with exactly one terminal event (`done` or a terminal
   * `error`) and stop promptly when `signal` aborts.
   */
  stream(request: AssistRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

/** Errors after which the request is over. `invalid_tool` only drops one proposal. */
export function isTerminal(event: StreamEvent): boolean {
  return event.type === 'done' || (event.type === 'error' && event.code !== 'invalid_tool');
}

export function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}
