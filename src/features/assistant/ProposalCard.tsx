import { useEffect, useRef, useState } from 'react';
import { actionsStore } from '../../actions/store.js';
import type { Proposal } from '../../actions/types.js';
import { ACTIONS, ASSIGNEES, RISK_EXPIRY_DAYS, type ActionCall } from '../../shared/actions.js';
import { detectInjection } from '../../shared/detectInjection.js';
import type { Finding } from '../../shared/finding.js';
import { PRIORITIES } from '../../shared/finding.js';
import { Badge, Button, Field, inputClass, type Tone } from '../../ui/index.js';

const STATE: Record<Proposal['state'], [string, Tone]> = {
  pending: ['Awaiting your review', 'warn'],
  rejected: ['Rejected', 'neutral'],
  succeeded: ['Approved · done', 'ok'],
  failed: ['Failed', 'danger'],
};

type Args = Record<string, string | number>;

function ArgsList({ call }: { call: ActionCall }) {
  const entries = Object.entries(call.args).filter(([k]) => k !== 'findingId');
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted">{key}</dt>
          {/* Model-provided strings render as text, never markup. */}
          <dd className="break-words">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditFields({
  call,
  draft,
  setDraft,
  issues,
}: {
  call: ActionCall;
  draft: Args;
  setDraft: (d: Args) => void;
  issues: Record<string, string>;
}) {
  const set = (key: string, value: string | number) => setDraft({ ...draft, [key]: value });
  switch (call.name) {
    case 'open_ticket':
      return (
        <>
          <Field label="Ticket title" error={issues.title} hint="Up to 120 characters">
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={String(draft.title ?? '')}
                onChange={(e) => set('title', e.target.value)}
              />
            )}
          </Field>
          <Field label="Assignee" error={issues.assignee}>
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={String(draft.assignee)}
                onChange={(e) => set('assignee', e.target.value)}
              >
                {ASSIGNEES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            )}
          </Field>
        </>
      );
    case 'set_priority':
      return (
        <>
          <Field label="Priority" error={issues.priority}>
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={String(draft.priority)}
                onChange={(e) => set('priority', e.target.value)}
              >
                {PRIORITIES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Reason" error={issues.reason}>
            {(p) => (
              <textarea
                {...p}
                rows={2}
                className={inputClass}
                value={String(draft.reason ?? '')}
                onChange={(e) => set('reason', e.target.value)}
              />
            )}
          </Field>
        </>
      );
    case 'accept_risk':
      return (
        <>
          <Field label="Justification" error={issues.justification} hint="At least 10 characters">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                className={inputClass}
                value={String(draft.justification ?? '')}
                onChange={(e) => set('justification', e.target.value)}
              />
            )}
          </Field>
          <Field label="Expires in (days)" error={issues.expiresInDays}>
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={Number(draft.expiresInDays)}
                onChange={(e) => set('expiresInDays', Number(e.target.value))}
              >
                {RISK_EXPIRY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      );
  }
}

export function ProposalCard({
  proposal,
  getBase,
}: {
  proposal: Proposal;
  getBase: (id: string) => Finding | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Args>(proposal.current.args as Args);
  const [issues, setIssues] = useState<Record<string, string>>({});
  // Outcome text lives inside the drawer: toasts render outside the modal dialog, where they are
  // inert and hidden behind it (a11y-auditor finding).
  const [outcome, setOutcome] = useState('');
  const [label, tone] = STATE[proposal.state];
  const pending = proposal.state === 'pending';
  const headingId = `proposal-${proposal.proposalId}`;
  const base = getBase(proposal.findingId);
  const tampered = base ? detectInjection(base.scannerText).suspicious : false;
  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Where focus should go after the next render, because the pressed button is about to unmount.
  const [focusTarget, setFocusTarget] = useState<
    'firstField' | 'firstInvalid' | 'edit' | 'heading' | null
  >(null);

  useEffect(() => {
    if (!focusTarget) return;
    const card = cardRef.current;
    const target =
      focusTarget === 'heading'
        ? headingRef.current
        : focusTarget === 'edit'
          ? editButtonRef.current
          : card?.querySelector<HTMLElement>(
              focusTarget === 'firstInvalid' ? '[aria-invalid="true"]' : 'input, select, textarea',
            );
    target?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  const approve = () => {
    const result = actionsStore.approve(proposal.proposalId, getBase, editing ? draft : undefined);
    if (result.kind === 'invalid') {
      setIssues(result.issues);
      setEditing(true);
      setOutcome(
        `Not approved: ${Object.values(result.issues)[0] ?? 'check the highlighted fields'}.`,
      );
      setFocusTarget('firstInvalid');
      return;
    }
    setIssues({});
    setEditing(false);
    if (result.kind === 'executed') setOutcome(`Approved and done. ${result.summary}`);
    if (result.kind === 'failed') setOutcome(`Approval failed: ${result.error}`);
    setFocusTarget('heading');
  };

  const cancelEdit = () => {
    setDraft(proposal.current.args as Args);
    setIssues({});
    setEditing(false);
    setFocusTarget('edit');
  };

  return (
    <section
      ref={cardRef}
      aria-labelledby={headingId}
      className="rounded-lg border border-line bg-surface p-3"
      data-testid="proposal"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 id={headingId} ref={headingRef} tabIndex={-1} className="text-sm font-semibold">
          Proposed action: {ACTIONS[proposal.current.name].label}
        </h4>
        <Badge tone={tone}>{label}</Badge>
        {proposal.edited && <Badge tone="accent">Edited by you</Badge>}
      </div>

      {pending && base && (base.kev || base.exploitValidated || tampered) && (
        <p className="mb-2 flex flex-wrap gap-1.5 text-xs">
          <span className="text-muted">Consider before approving:</span>
          {base.kev && <Badge tone="danger">Known exploited</Badge>}
          {base.exploitValidated && <Badge tone="warn">Exploit validated</Badge>}
          {tampered && <Badge tone="warn">Evidence may be tampered with</Badge>}
        </p>
      )}

      {editing && pending ? (
        // Escape handling scoped to the form: cancel the edit, keep the drawer open.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            approve();
          }}
          onKeyDown={(e) => {
            // Escape cancels the edit instead of closing the whole drawer and losing the draft.
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelEdit();
            }
          }}
        >
          <EditFields call={proposal.current} draft={draft} setDraft={setDraft} issues={issues} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="accent" size="sm">
              Approve edited action
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              Cancel edit
            </Button>
          </div>
        </form>
      ) : (
        <ArgsList call={proposal.current} />
      )}

      {proposal.edited && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer">What the analyst originally proposed</summary>
          <div className="mt-1">
            <ArgsList call={proposal.proposed} />
          </div>
        </details>
      )}
      {proposal.error && <p className="mt-2 text-sm text-danger">{proposal.error}</p>}

      {pending && !editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="accent" size="sm" onClick={approve}>
            Approve
          </Button>
          <Button
            ref={editButtonRef}
            size="sm"
            onClick={() => {
              setEditing(true);
              setFocusTarget('firstField');
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              actionsStore.reject(proposal.proposalId);
              setOutcome('Rejected. Nothing was changed.');
              setFocusTarget('heading');
            }}
          >
            Reject
          </Button>
        </div>
      )}
      {pending && (
        <p className="mt-2 text-xs text-muted">
          Nothing happens until you approve. Tickets and risk decisions are simulated.
        </p>
      )}
      <p role="status" className="sr-only">
        {outcome}
      </p>
    </section>
  );
}
