import { useCallback, useEffect, useRef, useState } from 'react';
import { actionsStore } from '../../actions/store.js';
import { isTerminal, newId, type AssistantProvider } from '../../ai/provider.js';
import { boundHistory, type ChatTurn, type ClientState } from '../../shared/assist.js';
import type { ErrorCode } from '../../shared/stream.js';

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  requestId: string;
  state: 'streaming' | 'done' | 'stopped' | 'error';
  mode?: 'mock' | 'live';
  error?: { code: ErrorCode; message: string; retryable: boolean };
  notes?: string[];
}

/** Only question/answer pairs whose answer completed: no stale unanswered questions in history. */
export function answeredPairs(turns: Turn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (let i = 0; i + 1 < turns.length; i++) {
    const [q, a] = [turns[i]!, turns[i + 1]!];
    if (q.role === 'user' && a.role === 'assistant' && a.state === 'done' && a.content) {
      out.push({ role: 'user', content: q.content }, { role: 'assistant', content: a.content });
      i++;
    }
  }
  return out;
}

/**
 * Conversation about one finding. Owns the request lifecycle: one request at a time, aborted on
 * stop/unmount (the panel is keyed by finding, so switching findings unmounts it), events from a
 * superseded request are ignored, and a stream without a terminal event is marked truncated.
 */
export function useAssistant(
  provider: AssistantProvider,
  findingId: string,
  getClientState: () => ClientState,
) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const active = useRef<{ requestId: string; controller: AbortController } | null>(null);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  useEffect(() => () => active.current?.controller.abort(), []);

  const patchTurn = (id: string, patch: (t: Turn) => Partial<Turn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)));

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim().slice(0, 500);
      if (!text || active.current) return;
      const requestId = newId('req');
      const controller = new AbortController();
      active.current = { requestId, controller };
      setBusy(true);

      const history = boundHistory(answeredPairs(turnsRef.current));
      const answerId = newId('turn');
      setTurns((prev) => [
        ...prev,
        { id: newId('turn'), role: 'user', content: text, requestId, state: 'done' },
        { id: answerId, role: 'assistant', content: '', requestId, state: 'streaming' },
      ]);

      let finished = false;
      try {
        const request = {
          requestId,
          findingId,
          question: text,
          history,
          clientState: getClientState(),
        };
        for await (const event of provider.stream(request, controller.signal)) {
          if (active.current?.requestId !== requestId || event.requestId !== requestId) break; // superseded
          switch (event.type) {
            case 'start':
              patchTurn(answerId, () => ({ mode: event.mode }));
              break;
            case 'text':
              patchTurn(answerId, (t) => ({ content: t.content + event.delta }));
              break;
            case 'tool_proposal':
              // A proposal that arrives after Stop belongs to an answer the user abandoned.
              if (controller.signal.aborted) break;
              actionsStore.propose({
                proposalId: event.proposalId,
                requestId,
                findingId,
                call: event.call,
              });
              break;
            case 'error':
              if (event.code === 'invalid_tool') {
                patchTurn(answerId, (t) => ({ notes: [...(t.notes ?? []), event.message] }));
              } else {
                patchTurn(answerId, () => ({
                  state: 'error',
                  error: { code: event.code, message: event.message, retryable: event.retryable },
                }));
              }
              break;
            case 'done':
              patchTurn(answerId, () => ({
                state: event.reason === 'aborted' ? 'stopped' : 'done',
              }));
              break;
          }
          if (isTerminal(event)) {
            finished = true;
            break;
          }
        }
        if (!finished && !controller.signal.aborted) {
          patchTurn(answerId, () => ({
            state: 'error',
            error: {
              code: 'truncated',
              message: 'The response ended unexpectedly.',
              retryable: true,
            },
          }));
        } else if (!finished) {
          patchTurn(answerId, () => ({ state: 'stopped' }));
        }
      } catch {
        patchTurn(answerId, () => ({
          state: 'error',
          error: {
            code: 'provider_error',
            message: 'Something went wrong while talking to the analyst.',
            retryable: true,
          },
        }));
      } finally {
        if (active.current?.requestId === requestId) {
          active.current = null;
          setBusy(false);
        }
      }
    },
    [provider, findingId, getClientState],
  );

  const stop = useCallback(() => active.current?.controller.abort(), []);

  return { turns, busy, ask, stop };
}
