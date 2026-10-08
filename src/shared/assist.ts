import { z } from 'zod';
import { PRIORITIES, STATUSES, type Finding } from './finding.ts';
import { detectInjection, type InjectionVerdict } from './detectInjection.ts';
import { redact } from './redact.ts';
import { priorityFor, riskDrivers, riskScore } from './risk.ts';

export const MAX_HISTORY_TURNS = 6;
export const MAX_REQUEST_BYTES = 8 * 1024;

/** Client-side state from approved actions. Bounded enums only, so it cannot carry free text. */
export const clientStateSchema = z.strictObject({
  status: z.enum(STATUSES),
  hasTicket: z.boolean(),
  priorityOverride: z.enum(PRIORITIES).optional(),
});

export const assistRequestSchema = z
  .strictObject({
    requestId: z.string().min(8).max(64),
    findingId: z.string().regex(/^DEMO-\d{4}-\d{5}$/),
    question: z.string().trim().min(1).max(500),
    history: z
      .array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
      .max(MAX_HISTORY_TURNS),
    clientState: clientStateSchema.optional(),
  })
  .refine((r) => JSON.stringify(r).length <= MAX_REQUEST_BYTES, 'Request exceeds 8 KB');

export type AssistRequest = z.infer<typeof assistRequestSchema>;
export type ChatTurn = AssistRequest['history'][number];
export type ClientState = NonNullable<AssistRequest['clientState']>;

/** Fields that never leave the server, whatever the model or the client asks for. */
export const EXCLUDED_FIELDS = ['hostname', 'ip', 'owner', 'assetId'] as const;

export interface FindingContext {
  finding: {
    id: string;
    title: string;
    cwe: string;
    cvss: number;
    epss: number;
    kev: boolean;
    exploitValidated: boolean;
    environment: string;
    assetCriticality: number;
    status: string;
    hasTicket: boolean;
    priorityOverride?: string;
    riskScore: number;
    computedPriority: string;
    drivers: string[];
    firstSeen: string;
    scanner: string;
  };
  untrustedScannerText: string;
  redactions: Record<string, number>;
  injection: InjectionVerdict;
  excludedFields: readonly string[];
}

/** The exact, allowlisted and redacted context a model receives about one finding. */
export function buildFindingContext(f: Finding, clientState?: ClientState): FindingContext {
  const score = riskScore(f);
  const redaction = redact(f.scannerText);
  return {
    finding: {
      id: f.id,
      title: redact(f.title).text,
      cwe: f.cwe,
      cvss: f.cvss,
      epss: f.epss,
      kev: f.kev,
      exploitValidated: f.exploitValidated,
      environment: f.environment,
      assetCriticality: f.assetCriticality,
      status: clientState?.status ?? f.status,
      hasTicket: clientState?.hasTicket ?? false,
      ...(clientState?.priorityOverride ? { priorityOverride: clientState.priorityOverride } : {}),
      riskScore: score,
      computedPriority: priorityFor(score),
      drivers: riskDrivers(f),
      firstSeen: f.firstSeen,
      scanner: f.scanner,
    },
    untrustedScannerText: redaction.text,
    redactions: redaction.counts,
    injection: detectInjection(`${f.title}\n${f.scannerText}`),
    excludedFields: EXCLUDED_FIELDS,
  };
}

/** Keep the last N turns and drop oldest turns until the request fits the byte budget. */
export function boundHistory(
  history: ChatTurn[],
  maxTurns = MAX_HISTORY_TURNS,
  maxChars = 6000,
): ChatTurn[] {
  const bounded = history
    .slice(-maxTurns)
    .map((t) => ({ ...t, content: t.content.slice(0, 2000) }));
  // Drop oldest turns in user/assistant pairs so history never starts with an assistant turn.
  while (
    bounded.length &&
    (bounded[0]!.role !== 'user' || JSON.stringify(bounded).length > maxChars)
  ) {
    bounded.splice(0, bounded[0]!.role === 'user' ? 2 : 1);
  }
  return bounded;
}
