import { useCallback, useId, useRef, useState } from 'react';
import { useActionsState } from '../../actions/store.ts';
import type { AssistantProvider } from '../../ai/provider.ts';
import type { Row } from '../../data/findings.ts';
import type { ClientState } from '../../shared/assist.ts';
import type { Finding } from '../../shared/finding.ts';
import { Badge, Button, cx, inputClass } from '../../ui/index.ts';
import { PayloadPreview } from './PayloadPreview.tsx';
import { ProposalCard } from './ProposalCard.tsx';
import { SafeMarkdown } from './SafeMarkdown.tsx';
import { useAssistant, type Turn } from './useAssistant.ts';

const SUGGESTIONS = [
  'What should we do about this?',
  'Why is this prioritised like this?',
  'What is EPSS?',
];

const ERROR_HINT: Partial<Record<NonNullable<Turn['error']>['code'], string>> = {
  unauthorized: 'The live analyst rejected our credentials.',
  rate_limited: 'Too many requests — wait a moment and retry.',
  timeout: 'No response in 30 seconds.',
  truncated: 'The answer was cut off; anything shown above may be incomplete.',
};

export function AssistantPanel({
  row,
  provider,
  getBase,
}: {
  row: Row;
  provider: AssistantProvider;
  getBase: (id: string) => Finding | undefined;
}) {
  const [question, setQuestion] = useState('');
  const inputId = useId();
  const getClientState = useCallback(
    (): ClientState => ({
      status: row.effectiveStatus,
      hasTicket: Boolean(row.ticketId),
      ...(row.priorityOverridden ? { priorityOverride: row.priority } : {}),
    }),
    [row.effectiveStatus, row.ticketId, row.priorityOverridden, row.priority],
  );
  const { turns, busy, ask, stop } = useAssistant(provider, row.id, getClientState);
  const proposals = useActionsState((s) => s.proposals);
  const forFinding = Object.values(proposals).filter((p) => p.findingId === row.id);

  const inputRef = useRef<HTMLInputElement>(null);
  const turnRequestIds = new Set(turns.map((t) => t.requestId));
  // Proposals persist across drawer closes and reloads; ones without a visible turn are listed
  // separately so they can still be approved or rejected.
  // Fixed at mount, so a card stays visible (with its new state) after you decide it.
  const [earlierIds] = useState(
    () => new Set(forFinding.filter((p) => p.state === 'pending').map((p) => p.proposalId)),
  );
  const earlier = forFinding.filter(
    (p) => earlierIds.has(p.proposalId) && !turnRequestIds.has(p.requestId),
  );
  const pendingCount = forFinding.filter((p) => p.state === 'pending').length;

  const submit = (text: string) => {
    if (busy) return;
    void ask(text);
    setQuestion('');
    inputRef.current?.focus(); // suggestion buttons disappear after the first question
  };

  return (
    <section aria-labelledby={`${inputId}-heading`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${inputId}-heading`} className="text-base font-semibold">
          AI analyst
        </h3>
        <Badge tone={provider.mode === 'live' ? 'ok' : 'neutral'}>
          {provider.mode === 'live' ? 'Live model' : 'Mock analyst'}
        </Badge>
      </div>

      {earlier.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Pending from an earlier conversation</h4>
          {earlier.map((p) => (
            <ProposalCard key={p.proposalId} proposal={p} getBase={getBase} />
          ))}
        </div>
      )}

      <PayloadPreview
        finding={getBase(row.id) ?? row}
        clientState={getClientState()}
        mode={provider.mode}
      />

      <ol className="flex flex-col gap-3" aria-label="Conversation">
        {turns.map((turn) => (
          <li
            key={turn.id}
            className={cx('flex flex-col gap-2', turn.role === 'user' && 'items-end')}
          >
            {turn.role === 'user' ? (
              <p className="max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-fg">
                <span className="sr-only">You asked: </span>
                {turn.content}
              </p>
            ) : (
              <div
                className="w-full rounded-lg border border-line bg-surface p-3 text-sm"
                aria-busy={turn.state === 'streaming'}
              >
                <span className="sr-only">Analyst: </span>
                {provider.mode === 'live' && turn.mode === 'mock' && (
                  <p className="mb-2 text-xs text-muted">
                    Live analyst not configured on this deployment — answered by the mock.
                  </p>
                )}
                {turn.content ? (
                  <SafeMarkdown>{turn.content}</SafeMarkdown>
                ) : (
                  turn.state === 'streaming' && <p className="text-muted">Thinking…</p>
                )}
                {turn.state === 'stopped' && <p className="mt-2 text-xs text-muted">Stopped.</p>}
                {turn.notes?.map((note, i) => (
                  <p key={i} className="mt-2 text-xs text-warn">
                    {note}
                  </p>
                ))}
                {turn.error && (
                  <div
                    role="alert"
                    className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger"
                  >
                    <strong>{turn.error.message}</strong> {ERROR_HINT[turn.error.code]}
                  </div>
                )}
                {forFinding
                  .filter((p) => p.requestId === turn.requestId)
                  .map((p) => (
                    <div key={p.proposalId} className="mt-3">
                      <ProposalCard proposal={p} getBase={getBase} />
                    </div>
                  ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* Polite status for screen readers instead of announcing every streamed token. */}
      <p role="status" className="sr-only">
        {busy
          ? 'Analyst is responding'
          : turns.length
            ? `Analyst finished responding${pendingCount ? `; ${pendingCount} proposed action${pendingCount > 1 ? 's' : ''} awaiting your review` : ''}`
            : ''}
      </p>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} size="sm" onClick={() => submit(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask the analyst about {row.id}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this finding…"
          className={cx(inputClass, 'h-9 flex-1')}
        />
        {busy ? (
          <Button
            size="md"
            onClick={() => {
              stop();
              inputRef.current?.focus();
            }}
          >
            Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={!question.trim()}>
            Ask
          </Button>
        )}
      </form>
    </section>
  );
}
