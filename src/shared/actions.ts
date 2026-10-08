import { z } from 'zod';
import { PRIORITIES } from './finding.ts';

/**
 * The only actions the AI analyst may PROPOSE. Nothing executes until a person approves it in the
 * UI, and the executor re-validates the (possibly edited) arguments at that moment.
 */
export const ASSIGNEES = ['app-sec', 'platform', 'network-ops', 'cloud-infra'] as const;
export const RISK_EXPIRY_DAYS = [30, 90, 180] as const;

const findingId = z.string().regex(/^DEMO-\d{4}-\d{5}$/, 'Unknown finding id');

export const openTicketArgs = z.strictObject({
  findingId,
  title: z
    .string()
    .trim()
    .min(3, 'Title is too short')
    .max(120, 'Title is limited to 120 characters'),
  assignee: z.enum(ASSIGNEES),
});

export const setPriorityArgs = z.strictObject({
  findingId,
  priority: z.enum(PRIORITIES),
  reason: z.string().trim().min(3, 'Give a reason').max(280, 'Reason is limited to 280 characters'),
});

export const acceptRiskArgs = z.strictObject({
  findingId,
  justification: z
    .string()
    .trim()
    .min(10, 'Justification needs at least 10 characters')
    .max(500, 'Justification is limited to 500 characters'),
  expiresInDays: z.union(RISK_EXPIRY_DAYS.map((d) => z.literal(d))),
});

export const ACTIONS = {
  open_ticket: {
    schema: openTicketArgs,
    label: 'Open remediation ticket',
    description:
      'Open a (simulated) remediation ticket for this finding and move it to in progress. Use when the finding is open, high priority and has no ticket.',
  },
  set_priority: {
    schema: setPriorityArgs,
    label: 'Override priority',
    description:
      'Override the computed priority when context the score cannot see justifies it. Always give the reason.',
  },
  accept_risk: {
    schema: acceptRiskArgs,
    label: 'Accept risk',
    description:
      'Record a time-boxed risk acceptance. Only for low-risk findings with a business justification; never for KEV or validated exploits.',
  },
} as const;

export type ActionName = keyof typeof ACTIONS;
export const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

export const actionCallSchema = z.discriminatedUnion('name', [
  z.strictObject({ name: z.literal('open_ticket'), args: openTicketArgs }),
  z.strictObject({ name: z.literal('set_priority'), args: setPriorityArgs }),
  z.strictObject({ name: z.literal('accept_risk'), args: acceptRiskArgs }),
]);

export type ActionCall = z.infer<typeof actionCallSchema>;

export type ValidationResult =
  { ok: true; call: ActionCall } | { ok: false; error: string; issues: Record<string, string> };

export function validateActionCall(name: string, args: unknown): ValidationResult {
  if (!(name in ACTIONS)) return { ok: false, error: `Unknown action "${name}"`, issues: {} };
  const parsed = actionCallSchema.safeParse({ name, args });
  if (parsed.success) return { ok: true, call: parsed.data };
  const issues: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path.at(-1) ?? 'args');
    issues[key] ??= issue.message;
  }
  return { ok: false, error: 'Invalid action arguments', issues };
}
