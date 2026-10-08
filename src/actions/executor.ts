import { ACTIONS, validateActionCall, type ActionCall } from '../shared/actions.js';
import { detectInjection } from '../shared/detectInjection.js';
import type { Finding, Priority, Status } from '../shared/finding.js';
import { priorityFor, riskScore } from '../shared/risk.js';
import { STATUS_LABEL } from '../shared/finding.js';
import type { ActionsState, FindingOverride, Proposal } from './types.js';

export type ExecuteResult =
  | { kind: 'executed'; state: ActionsState; summary: string }
  | { kind: 'failed'; state: ActionsState; error: string }
  /** Arguments do not validate: nothing changes, the proposal stays pending for correction. */
  | { kind: 'invalid'; state: ActionsState; issues: Record<string, string> }
  /** Already decided (double click, replayed event): idempotent no-op. */
  | { kind: 'noop'; state: ActionsState };

const now = () => new Date().toISOString();

/** Higher number = lower priority. */
const PRIORITY_RANK: Record<Priority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

export function addProposal(
  state: ActionsState,
  input: { proposalId: string; requestId: string; findingId: string; call: ActionCall },
): ActionsState {
  if (state.proposals[input.proposalId]) return state;
  if (input.call.args.findingId !== input.findingId) return state; // bound to the finding it was asked about
  const proposal: Proposal = {
    proposalId: input.proposalId,
    requestId: input.requestId,
    findingId: input.findingId,
    proposed: input.call,
    current: input.call,
    edited: false,
    state: 'pending',
    createdAt: now(),
  };
  return { ...state, proposals: { ...state.proposals, [proposal.proposalId]: proposal } };
}

export function rejectProposal(state: ActionsState, proposalId: string): ActionsState {
  const p = state.proposals[proposalId];
  if (!p || p.state !== 'pending') return state;
  return {
    ...state,
    proposals: { ...state.proposals, [proposalId]: { ...p, state: 'rejected', decidedAt: now() } },
    audit: [
      ...state.audit,
      {
        at: now(),
        findingId: p.findingId,
        proposalId,
        actor: 'you',
        summary: `Rejected proposal: ${ACTIONS[p.current.name].label}`,
      },
    ],
  };
}

function effectiveStatus(base: Finding, override?: FindingOverride): Status {
  return override?.status ?? base.status;
}

/**
 * Approve and run a proposal. Re-validates the (possibly edited) arguments, enforces the finding
 * binding and status transitions, and is idempotent per proposal id.
 */
export function approveProposal(
  state: ActionsState,
  proposalId: string,
  getBase: (id: string) => Finding | undefined,
  editedArgs?: unknown,
): ExecuteResult {
  const p = state.proposals[proposalId];
  if (!p || p.state !== 'pending') return { kind: 'noop', state };

  const validation = validateActionCall(p.current.name, editedArgs ?? p.current.args);
  if (!validation.ok) return { kind: 'invalid', state, issues: validation.issues };
  const call = validation.call;
  const edited = editedArgs !== undefined && JSON.stringify(call) !== JSON.stringify(p.proposed);

  const fail = (error: string): ExecuteResult => ({
    kind: 'failed',
    error,
    state: {
      ...state,
      proposals: {
        ...state.proposals,
        [proposalId]: { ...p, current: call, edited, state: 'failed', error, decidedAt: now() },
      },
      audit: [
        ...state.audit,
        {
          at: now(),
          findingId: p.findingId,
          proposalId,
          actor: 'analyst (approved by you)',
          summary: `Failed: ${error}`,
        },
      ],
    },
  });

  if (call.args.findingId !== p.findingId)
    return fail('The action targets a different finding than the one discussed.');
  const base = getBase(p.findingId);
  if (!base) return fail('Finding no longer exists.');

  const override = state.overrides[p.findingId] ?? {};
  const tampered = detectInjection(base.scannerText).suspicious;
  const status = effectiveStatus(base, override);
  let next: FindingOverride;
  let summary: string;
  let nextTicket = state.nextTicket;

  switch (call.name) {
    case 'open_ticket': {
      if (override.ticketId) return fail(`Already tracked in ${override.ticketId}.`);
      if (status !== 'open' && status !== 'in_progress')
        return fail(
          `Cannot open a ticket for a finding that is ${STATUS_LABEL[status].toLowerCase()}.`,
        );
      const ticketId = `SIM-${nextTicket++}`;
      next = { ...override, ticketId, status: 'in_progress' };
      summary = `Opened simulated ticket ${ticketId} for ${call.args.assignee}: “${call.args.title}”`;
      break;
    }
    case 'set_priority': {
      if (status === 'resolved') return fail('Resolved findings keep their priority.');
      if (
        tampered &&
        PRIORITY_RANK[call.args.priority] >
          PRIORITY_RANK[override.priority ?? priorityFor(riskScore(base))]
      ) {
        return fail(
          'Policy: an AI proposal cannot lower the priority of a finding whose evidence looks tampered with.',
        );
      }
      next = { ...override, priority: call.args.priority, priorityReason: call.args.reason };
      summary = `Priority set to ${call.args.priority}: ${call.args.reason}`;
      break;
    }
    case 'accept_risk': {
      // Enforced in code, not just in the prompt: the actions an injection would aim for.
      if (base.kev || base.exploitValidated)
        return fail('Policy: risk cannot be accepted for known-exploited or validated findings.');
      if (tampered)
        return fail('Policy: risk cannot be accepted while the evidence looks tampered with.');
      if (status !== 'open' && status !== 'in_progress')
        return fail(
          `Risk can only be accepted for open or in-progress findings (this one is ${STATUS_LABEL[status].toLowerCase()}).`,
        );
      const until = new Date(Date.now() + call.args.expiresInDays * 86_400_000)
        .toISOString()
        .slice(0, 10);
      next = { ...override, status: 'risk_accepted', riskAcceptedUntil: until };
      summary = `Risk accepted until ${until}: ${call.args.justification}`;
      break;
    }
  }

  return {
    kind: 'executed',
    summary,
    state: {
      ...state,
      nextTicket,
      overrides: { ...state.overrides, [p.findingId]: next },
      proposals: {
        ...state.proposals,
        [proposalId]: {
          ...p,
          current: call,
          edited,
          state: 'succeeded',
          error: undefined,
          decidedAt: now(),
        },
      },
      audit: [
        ...state.audit,
        {
          at: now(),
          findingId: p.findingId,
          proposalId,
          actor: 'analyst (approved by you)',
          summary: edited ? `${summary} (edited before approval)` : summary,
        },
      ],
    },
  };
}
