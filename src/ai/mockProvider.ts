import type { ActionCall } from '../shared/actions.ts';
import { buildFindingContext, type AssistRequest, type FindingContext } from '../shared/assist.ts';
import type { Finding } from '../shared/finding.ts';
import type { StreamEvent } from '../shared/stream.ts';
import { newId, type AssistantProvider } from './provider.ts';

/**
 * Deterministic scripted analyst. It reads the same allowlisted, redacted context a live model
 * would get and follows the same rules the system prompt gives Claude, so the hosted demo works
 * without credentials and E2E tests are stable.
 */
export function planResponse(
  ctx: FindingContext,
  question: string,
): { text: string; calls: ActionCall[] } {
  const f = ctx.finding;
  const priority = f.priorityOverride ?? f.computedPriority;
  const lines: string[] = [];
  const calls: ActionCall[] = [];
  const asksDefinition = /\b(what is|what's|explain)\b.*\b(epss|kev|cvss)\b/i.exec(question);

  if (ctx.injection.suspicious) {
    lines.push(
      `> **Heads-up:** the scanner output for this finding contains text that reads like instructions to an AI (${ctx.injection.signals.join(', ')}). I treat scanner output as data, so I am not following it.`,
      '',
    );
  }

  if (asksDefinition) {
    const term = asksDefinition[2]!.toUpperCase();
    const definitions: Record<string, string> = {
      EPSS: `**EPSS** estimates the probability that a vulnerability is exploited in the wild in the next 30 days. Here it is **${(f.epss * 100).toFixed(1)}%**.`,
      KEV: `**KEV** means the vulnerability appears in a catalog of known exploited vulnerabilities. This finding is **${f.kev ? 'on' : 'not on'}** that list.`,
      CVSS: `**CVSS** rates technical severity from 0 to 10 without your environment's context. Here it is **${f.cvss.toFixed(1)}**.`,
    };
    lines.push(definitions[term] ?? '');
    return { text: lines.join('\n'), calls };
  }

  lines.push(
    `**${f.id} is ${priority}** (risk score ${f.riskScore.toFixed(2)}${f.priorityOverride ? `, overridden from ${f.computedPriority}` : ''}).`,
    '',
    'What drives it, strongest first:',
    ...f.drivers.map((d) => `- ${d}`),
    '',
    `It sits on a **${f.environment}** asset and is currently **${f.status.replace('_', ' ')}**.`,
  );

  const actionable = f.status === 'open' || f.status === 'in_progress';
  if (actionable && (priority === 'P1' || priority === 'P2') && !f.hasTicket) {
    lines.push('', 'I recommend tracking the fix now. Review the ticket below before approving.');
    calls.push({
      name: 'open_ticket',
      args: {
        findingId: f.id,
        title: `Remediate ${f.title}`.slice(0, 120),
        assignee:
          f.environment === 'corporate'
            ? 'network-ops'
            : /CWE-(79|89|22|918)/.test(f.cwe)
              ? 'app-sec'
              : 'platform',
      },
    });
  } else if (actionable && f.kev && (priority === 'P3' || priority === 'P4')) {
    lines.push(
      '',
      'The score under-weights that this is known to be exploited, so I suggest raising the priority.',
    );
    calls.push({
      name: 'set_priority',
      args: {
        findingId: f.id,
        priority: 'P2',
        reason: 'Known exploited (KEV); score under-weights active exploitation.',
      },
    });
  } else if (ctx.injection.suspicious) {
    // Tampered-looking evidence is itself a signal: never suggest accepting the risk here.
    lines.push(
      '',
      'Because the evidence looks tampered with, I will not suggest accepting this risk. Have someone verify the asset and the scanner result first.',
    );
  } else if (
    f.status === 'open' &&
    priority === 'P4' &&
    !f.kev &&
    !f.exploitValidated &&
    f.epss < 0.01
  ) {
    lines.push(
      '',
      'Exploitation is unlikely and nothing is validated. A time-boxed risk acceptance is reasonable if the owner agrees.',
    );
    calls.push({
      name: 'accept_risk',
      args: {
        findingId: f.id,
        justification: `Low exploitation likelihood (EPSS ${(f.epss * 100).toFixed(2)}%), not KEV-listed, no validated exploit. Revisit at expiry.`,
        expiresInDays: 90,
      },
    });
  } else {
    lines.push('', 'No action needed from me right now.');
  }

  lines.push('', '_Mock analyst: scripted from the same context a live model receives._');
  return { text: lines.join('\n'), calls };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });

export function createMockProvider(
  getFinding: (id: string) => Finding | undefined,
  options: { delayMs?: number } = {},
): AssistantProvider {
  const delayMs = options.delayMs ?? 18;
  return {
    mode: 'mock',
    async *stream(request: AssistRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
      const { requestId } = request;
      yield { type: 'start', requestId, mode: 'mock' };
      const finding = getFinding(request.findingId);
      if (!finding) {
        yield {
          type: 'error',
          requestId,
          code: 'invalid_request',
          message: 'Unknown finding.',
          retryable: false,
        };
        return;
      }
      const { text, calls } = planResponse(
        buildFindingContext(finding, request.clientState),
        request.question,
      );
      // Word-sized chunks, like a real token stream.
      for (const chunk of text.match(/\S+\s*|\s+/g) ?? []) {
        if (signal.aborted) {
          yield { type: 'done', requestId, reason: 'aborted' };
          return;
        }
        yield { type: 'text', requestId, delta: chunk };
        await sleep(delayMs, signal);
      }
      // Don't hand out proposals for an answer the user stopped.
      if (!signal.aborted) {
        for (const call of calls)
          yield { type: 'tool_proposal', requestId, proposalId: newId('prop'), call };
      }
      yield { type: 'done', requestId, reason: signal.aborted ? 'aborted' : 'end_turn' };
    },
  };
}
