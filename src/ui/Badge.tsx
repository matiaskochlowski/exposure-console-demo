import type { ReactNode } from 'react';
import type { Domain, Environment, Priority, Status } from '../shared/finding.js';
import { DOMAIN_LABEL, ENVIRONMENT_LABEL, STATUS_LABEL } from '../shared/finding.js';
import { cx } from './cx.js';
import { DOMAIN_TONE, ENVIRONMENT_TONE, PRIORITY_TONE, STATUS_TONE } from './tones.js';

export type Tone =
  | 'neutral'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'accent'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'c1'
  | 'c2'
  | 'c3'
  | 'c4'
  | 'c5'
  | 'c6';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-surface-2 text-accent',
  // Priorities are solid fills, like a risk-index chip; each -fg token is AA on its fill.
  p1: 'bg-p1 text-p1-fg',
  p2: 'bg-p2 text-p2-fg',
  p3: 'bg-p3 text-p3-fg',
  p4: 'bg-p4 text-p4-fg',
  // Categorical hues for groupings (domain), kept apart from the status and priority colours.
  c1: 'bg-c1-soft text-c1',
  c2: 'bg-c2-soft text-c2',
  c3: 'bg-c3-soft text-c3',
  c4: 'bg-c4-soft text-c4',
  c5: 'bg-c5-soft text-c5',
  c6: 'bg-c6-soft text-c6',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Priority is always shown as text as well as colour (WCAG 1.4.1). */
export function PriorityBadge({
  priority,
  overridden = false,
}: {
  priority: Priority;
  overridden?: boolean;
}) {
  return (
    <Badge tone={PRIORITY_TONE[priority]} className="min-w-9 justify-center rounded-sm font-bold">
      {priority}
      {overridden && (
        <>
          <span aria-hidden="true">*</span>
          <span className="sr-only"> (overridden by a person)</span>
        </>
      )}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Small grey letter chip for exploitation evidence; the short label is expanded for AT and on hover. */
export function EvidenceChip({ short, label }: { short: string; label: string }) {
  return (
    <span
      title={label}
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm bg-chip px-1.5 text-xs font-bold text-chip-fg"
    >
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return <Badge tone={ENVIRONMENT_TONE[environment]}>{ENVIRONMENT_LABEL[environment]}</Badge>;
}

export function DomainBadge({ domain }: { domain: Domain }) {
  return <Badge tone={DOMAIN_TONE[domain]}>{DOMAIN_LABEL[domain]}</Badge>;
}
