import type { ActionCall } from '../shared/actions.ts';
import type { Priority, Status } from '../shared/finding.ts';

/** Human/simulated changes layered over the static dataset. */
export interface FindingOverride {
  status?: Status;
  priority?: Priority;
  priorityReason?: string;
  ticketId?: string;
  riskAcceptedUntil?: string;
}

/**
 * pending → (edited) → approved → executing → succeeded | failed, or pending → rejected.
 * The simulated executor is synchronous, so "approved" and "executing" are transient and only the
 * stable states are stored. An async executor (real ticketing) would persist them too.
 */
export type ProposalState = 'pending' | 'rejected' | 'succeeded' | 'failed';

export interface Proposal {
  proposalId: string;
  requestId: string;
  findingId: string;
  /** What the model proposed, kept for the audit trail even after edits. */
  proposed: ActionCall;
  /** What will run (equals `proposed` unless a person edited it). */
  current: ActionCall;
  edited: boolean;
  state: ProposalState;
  error?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface AuditEntry {
  at: string;
  findingId: string;
  proposalId?: string;
  summary: string;
  actor: 'analyst (approved by you)' | 'you';
}

export interface ActionsState {
  overrides: Record<string, FindingOverride>;
  proposals: Record<string, Proposal>;
  audit: AuditEntry[];
  nextTicket: number;
}

export const EMPTY_STATE: ActionsState = {
  overrides: {},
  proposals: {},
  audit: [],
  nextTicket: 1001,
};
