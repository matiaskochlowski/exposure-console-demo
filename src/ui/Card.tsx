import type { ReactNode } from 'react';
import { cx } from './cx.js';

/** Bordered surface for dashboard sections and the queue. */
export function Card({
  children,
  className,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  /** Id of the card's heading; makes the card a labelled region. */
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cx('min-w-0 rounded-xl border border-line bg-surface shadow-sm', className)}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  id,
  title,
  description,
  hint,
  action,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** A ConceptHint or similar, shown right after the title. */
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <h2 id={id} className="text-base font-bold">
            {title}
          </h2>
          {hint}
        </div>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
