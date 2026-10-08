import type { ReactNode } from 'react';
import type { Priority, Status } from '../shared/finding.ts';
import { STATUS_LABEL } from '../shared/finding.ts';
import { cx } from './cx.ts';

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' | 'p1' | 'p2' | 'p3' | 'p4';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-surface-2 text-accent',
  p1: 'bg-p1-soft text-p1',
  p2: 'bg-p2-soft text-p2',
  p3: 'bg-p3-soft text-p3',
  p4: 'bg-p4-soft text-p4',
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

const PRIORITY_TONE: Record<Priority, Tone> = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4' };

/** Priority is always shown as text as well as colour (WCAG 1.4.1). */
export function PriorityBadge({
  priority,
  overridden = false,
}: {
  priority: Priority;
  overridden?: boolean;
}) {
  return (
    <Badge tone={PRIORITY_TONE[priority]}>
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

const STATUS_TONE: Record<Status, Tone> = {
  open: 'neutral',
  in_progress: 'accent',
  risk_accepted: 'warn',
  resolved: 'ok',
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
