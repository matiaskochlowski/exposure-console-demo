import { z } from 'zod';
import { actionCallSchema } from '../shared/actions.ts';
import { PRIORITIES, STATUSES } from '../shared/finding.ts';
import { EMPTY_STATE, type ActionsState } from './types.ts';

/** localStorage is untrusted (older builds, other tabs, hand edits): parse it before use. */
const overrideSchema = z.strictObject({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  priorityReason: z.string().max(280).optional(),
  ticketId: z.string().max(20).optional(),
  riskAcceptedUntil: z.string().max(10).optional(),
});

const proposalSchema = z.strictObject({
  proposalId: z.string().max(80),
  requestId: z.string().max(80),
  findingId: z.string().max(20),
  proposed: actionCallSchema,
  current: actionCallSchema,
  edited: z.boolean(),
  state: z.enum(['pending', 'rejected', 'succeeded', 'failed']),
  error: z.string().max(500).optional(),
  createdAt: z.string(),
  decidedAt: z.string().optional(),
});

const auditSchema = z.strictObject({
  at: z.string(),
  findingId: z.string(),
  proposalId: z.string().optional(),
  summary: z.string().max(1000),
  actor: z.enum(['analyst (approved by you)', 'you']),
});

const stateSchema = z.strictObject({
  overrides: z.record(z.string(), overrideSchema),
  proposals: z.record(z.string(), proposalSchema),
  audit: z.array(auditSchema).max(5000),
  nextTicket: z.number().int().min(1001),
});

export function parseActionsState(raw: string | null): ActionsState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}
