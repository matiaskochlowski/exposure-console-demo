import { useEffect, useId, useState, type ReactNode } from 'react';
import type { WeekBucket } from './stats.js';

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** Peak plus ~10% headroom, rounded up to an even number so the middle tick is whole. */
function axisMax(n: number) {
  return Math.max(2, Math.ceil((n * 1.1) / 2) * 2);
}

export interface BarDatum {
  key: string;
  label: ReactNode;
  value: number;
  /** Text after the value at the bar tip, e.g. "%". */
  suffix?: string;
  /** E.g. a ConceptHint. Kept outside the truncating label so it can never be clipped. */
  hint?: ReactNode;
}

/**
 * Horizontal bars, one series. Every value is printed at its bar tip, so the list itself is the
 * accessible (and table) view; the bars are decoration for sighted comparison.
 */
export function BarList({ data, labelWidth = 'w-40' }: { data: BarDatum[]; labelWidth?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.key} className="flex items-center gap-3 text-sm">
          <span className={`${labelWidth} flex shrink-0 items-center gap-1`}>
            <span className="min-w-0 truncate">{d.label}</span>
            {d.hint}
          </span>
          {/* The track has a fixed share of the row, so bar length stays proportional to the value. */}
          <span aria-hidden="true" className="min-w-0 flex-1">
            <span
              className="block h-4 rounded-r bg-accent"
              style={{ width: `${Math.max((d.value / max) * 100, 1)}%` }}
            />
          </span>
          <span className="w-14 shrink-0 text-right font-bold tabular-nums">
            {d.value.toLocaleString()}
            {d.suffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Weekly column chart, one series, with a per-column hover readout and a table view. Plain HTML
 * columns (not SVG) so it reflows at any width without distorting marks.
 */
export function WeeklyColumns({
  data,
  label,
  partialLast = false,
}: {
  data: WeekBucket[];
  label: string;
  /** The last week is still in progress: drawn faded and labelled, so its dip isn't misread. */
  partialLast?: boolean;
}) {
  const [hover, setHover] = useState<number>();
  const tableId = useId();
  const max = axisMax(Math.max(...data.map((d) => d.count)));
  const ticks = [max, max / 2, 0];
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]!);
  const total = data.reduce((n, d) => n + d.count, 0);
  const summary = `${label}: ${total.toLocaleString()} in ${data.length} weeks, peaking at ${peak.count.toLocaleString()} in the week of ${shortDate(peak.start)}.${partialLast ? ' The latest week is still in progress.' : ''}`;
  const isPartial = (i: number) => partialLast && i === data.length - 1;
  const active = hover === undefined ? undefined : data[hover];

  // The hover readout is dismissible with Escape (WCAG 1.4.13).
  useEffect(() => {
    if (hover === undefined) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHover(undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hover]);

  return (
    <div>
      <div className="flex gap-2">
        {/* Y axis */}
        <div
          aria-hidden="true"
          className="flex h-36 flex-col justify-between text-right text-xs text-muted tabular-nums"
        >
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t.toLocaleString()}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Gridlines: hairline, solid, recessive. */}
          <div aria-hidden="true" className="absolute inset-0 flex h-36 flex-col justify-between">
            {ticks.map((t) => (
              <span key={t} className="h-px bg-line" />
            ))}
          </div>
          <div
            role="img"
            aria-label={summary}
            className="relative flex h-36 items-end gap-0.5"
            onPointerLeave={() => setHover(undefined)}
          >
            {data.map((d, i) => (
              <div
                key={d.start}
                // The whole slot is the hit target, not just the bar.
                onPointerEnter={() => setHover(i)}
                className="flex h-full flex-1 items-end justify-center"
              >
                <span
                  className={`w-full max-w-6 rounded-t bg-accent transition-opacity ${(hover !== undefined && hover !== i) || isPartial(i) ? 'opacity-40' : ''}`}
                  style={{ height: `${(d.count / max) * 100}%` }}
                />
              </div>
            ))}
            {active && hover !== undefined && (
              <div
                aria-hidden="true"
                // Inside the plot and hoverable: it is a child of the element whose pointerleave
                // hides it, so moving onto it keeps it open.
                className="absolute top-0 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
                style={{
                  left: `${((hover + 0.5) / data.length) * 100}%`,
                  transform: `translateX(${hover > data.length / 2 ? '-100%' : '0'})`,
                }}
              >
                <strong className="text-sm tabular-nums">{active.count.toLocaleString()}</strong>{' '}
                new · week of {shortDate(active.start)}
                {isPartial(hover) && ' (in progress)'}
              </div>
            )}
          </div>
          {/* X axis: a label every 4 weeks. */}
          <div aria-hidden="true" className="mt-1.5 flex text-xs text-muted">
            {data.map((d, i) => (
              <span key={d.start} className="flex-1 overflow-visible whitespace-nowrap">
                {i % 4 === 0 ? shortDate(d.start) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-accent">Show as table</summary>
        <table id={tableId} className="mt-2 w-full max-w-sm text-left">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-1 font-semibold">
                Week of
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                New exposures
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.start} className="border-b border-row-line">
                <td className="py-1">
                  {shortDate(d.start)}
                  {isPartial(i) && ' (in progress)'}
                </td>
                <td className="py-1 text-right tabular-nums">{d.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
