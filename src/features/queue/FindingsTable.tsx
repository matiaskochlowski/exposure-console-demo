import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Row } from '../../data/findings.js';
import { Badge, PriorityBadge, StatusBadge, cx } from '../../ui/index.js';
import type { Filters, SortKey } from './filters.js';

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 40;

interface FindingsTableProps {
  rows: Row[];
  totalCount: number;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (select: boolean) => void;
  onOpen: (id: string) => void;
  sort: Filters['sort'];
  dir: Filters['dir'];
  onSort: (key: SortKey) => void;
  /** Row to scroll to and focus (after closing the drawer); a new object re-triggers it. */
  focusRequest?: { id: string };
}

const SORTABLE: Partial<Record<string, SortKey>> = {
  Finding: 'id',
  Risk: 'risk',
  CVSS: 'cvss',
  EPSS: 'epss',
  'First seen': 'firstSeen',
};

function SortHeader({
  label,
  sort,
  dir,
  onSort,
  className,
}: {
  label: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const key = SORTABLE[label];
  const active = key === sort;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cx('px-3 text-left text-xs font-semibold text-muted', className)}
    >
      {key ? (
        <button
          type="button"
          onClick={() => onSort(key)}
          className="inline-flex items-center gap-1 rounded hover:text-fg"
        >
          {label}
          <span aria-hidden="true" className={cx('text-[10px]', !active && 'opacity-0')}>
            {dir === 'asc' ? '▲' : '▼'}
          </span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}

const FindingRow = memo(function FindingRow({
  row,
  index,
  active,
  checked,
  onToggle,
  onOpen,
  onFocusRow,
}: {
  row: Row;
  index: number;
  active: boolean;
  checked: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onFocusRow: (index: number) => void;
}) {
  return (
    <tr
      data-index={index}
      data-id={row.id}
      aria-rowindex={index + 2}
      tabIndex={active ? 0 : -1}
      onFocus={() => onFocusRow(index)}
      onClick={() => onOpen(row.id)}
      className={cx(
        'h-14 cursor-pointer border-b border-line outline-none hover:bg-surface-2 [&:focus-visible>td]:bg-surface-2 [&:focus-visible>td]:shadow-[inset_0_2px_0_var(--focus),inset_0_-2px_0_var(--focus)]',
        checked && 'bg-surface-2',
      )}
    >
      <td className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(row.id)}
          aria-label={`Select ${row.id}`}
          tabIndex={-1}
          className="size-4 accent-[var(--accent)]"
        />
      </td>
      <td className="max-w-0 px-3">
        <div className="truncate text-sm font-medium text-fg">
          {row.title}
          {checked && <span className="sr-only">, selected</span>}
        </div>
        <div className="truncate font-mono text-xs text-muted">
          {row.id} · {row.hostname}
        </div>
      </td>
      <td className="px-3">
        <PriorityBadge priority={row.priority} overridden={row.priorityOverridden} />
      </td>
      <td className="hidden px-3 text-sm tabular-nums md:table-cell">{row.riskScore.toFixed(2)}</td>
      <td className="hidden px-3 text-sm tabular-nums lg:table-cell">{row.cvss.toFixed(1)}</td>
      <td className="hidden px-3 text-sm tabular-nums lg:table-cell">
        {(row.epss * 100).toFixed(1)}%
      </td>
      <td className="hidden px-3 md:table-cell">
        <div className="flex gap-1">
          {row.kev && <Badge tone="danger">KEV</Badge>}
          {row.exploitValidated && <Badge tone="warn">Validated</Badge>}
        </div>
      </td>
      <td className="hidden px-3 text-sm text-muted xl:table-cell">{row.firstSeen}</td>
      <td className="px-3">
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge status={row.effectiveStatus} />
          {row.ticketId && <span className="font-mono text-[11px] text-muted">{row.ticketId}</span>}
        </div>
      </td>
    </tr>
  );
});

/**
 * Native <table> virtualised with spacer rows: only ~visible rows are in the DOM, yet the table
 * keeps real table semantics (headers, aria-rowcount/rowindex) for assistive tech. Rows use a roving
 * tabindex: Tab enters the table once, arrows move, Enter opens, Space selects.
 */
export function FindingsTable({
  rows,
  totalCount,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  sort,
  dir,
  onSort,
  focusRequest,
}: FindingsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerCheckbox = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollPaddingStart: HEADER_HEIGHT,
    initialRect: { width: 1024, height: 640 },
  });

  const selectedVisible = rows.reduce((n, r) => n + (selected.has(r.id) ? 1 : 0), 0);
  const allChecked = rows.length > 0 && selectedVisible === rows.length;
  useEffect(() => {
    if (headerCheckbox.current)
      headerCheckbox.current.indeterminate = selectedVisible > 0 && !allChecked;
  }, [selectedVisible, allChecked]);

  // Keep the roving index inside the list when filters shrink it.
  const safeActive = Math.min(activeIndex, Math.max(rows.length - 1, 0));

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setActiveIndex(clamped);
    virtualizer.scrollToIndex(clamped, { align: 'auto' });
    // The row may only exist after the virtualizer re-renders.
    requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector<HTMLElement>(`tr[data-index="${clamped}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (!focusRequest) return;
    const index = rows.findIndex((r) => r.id === focusRequest.id);
    if (index >= 0) focusRow(index);
    // Only when a new request arrives (drawer closed), not on every rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const row = rows[safeActive];
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_HEIGHT) - 1);
    const moves: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: page,
      PageUp: -page,
    };
    if (event.key in moves) focusRow(safeActive + moves[event.key]!);
    else if (event.key === 'Home') focusRow(0);
    else if (event.key === 'End') focusRow(rows.length - 1);
    else if (event.key === 'Enter' && row) onOpen(row.id);
    else if (event.key === ' ' && row) onToggle(row.id);
    else return;
    event.preventDefault();
  };

  const items = virtualizer.getVirtualItems();
  // If the roving row scrolled out of the rendered window, make the first rendered row the Tab stop,
  // otherwise Tab would skip the table entirely (code-reviewer finding).
  const tabStop = items.some((i) => i.index === safeActive) ? safeActive : (items[0]?.index ?? 0);
  const paddingTop = items[0]?.start ?? 0;
  const paddingBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);

  return (
    // overflow-anchor: none — otherwise the browser's scroll anchoring "compensates" when the top
    // spacer row grows and doubles every programmatic jump (found via e2e: focus restore landed ~2× too far).
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-auto [overflow-anchor:none] [scroll-padding-top:40px]"
      data-testid="queue-scroll"
    >
      <p id="findings-keys" className="sr-only">
        Use arrow keys, Page Up, Page Down, Home and End to move between rows, Enter to open a
        finding, Space to select it.
      </p>
      <table
        className="w-full table-fixed border-collapse"
        aria-label="Findings"
        aria-describedby="findings-keys"
        aria-rowcount={rows.length + 1}
      >
        <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--line)]">
          <tr aria-rowindex={1} style={{ height: HEADER_HEIGHT }}>
            <th scope="col" className="w-10 px-3">
              <input
                ref={headerCheckbox}
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label={`Select all ${rows.length} matching findings`}
                className="size-4 accent-[var(--accent)]"
              />
            </th>
            <SortHeader label="Finding" sort={sort} dir={dir} onSort={onSort} />
            <th
              scope="col"
              className="w-16 px-3 text-left text-xs font-semibold text-muted sm:w-20"
            >
              Priority
            </th>
            <SortHeader
              label="Risk"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-20 md:table-cell"
            />
            <SortHeader
              label="CVSS"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-20 lg:table-cell"
            />
            <SortHeader
              label="EPSS"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-20 lg:table-cell"
            />
            <th
              scope="col"
              className="hidden w-40 px-3 text-left text-xs font-semibold text-muted md:table-cell"
            >
              Exploitation
            </th>
            <SortHeader
              label="First seen"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-28 xl:table-cell"
            />
            <th
              scope="col"
              className="w-28 px-3 text-left text-xs font-semibold text-muted sm:w-32"
            >
              Status
            </th>
          </tr>
        </thead>
        {/* Keyboard handling is delegated from the focusable rows (roving tabindex) to their tbody. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <tbody onKeyDown={onKeyDown}>
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td style={{ height: paddingTop, padding: 0 }} />
            </tr>
          )}
          {items.map((item) => {
            const row = rows[item.index]!;
            return (
              <FindingRow
                key={row.id}
                row={row}
                index={item.index}
                active={item.index === tabStop}
                checked={selected.has(row.id)}
                onToggle={onToggle}
                onOpen={onOpen}
                onFocusRow={setActiveIndex}
              />
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td style={{ height: paddingBottom, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-6 py-16 text-center text-sm text-muted">
          No findings match these filters ({totalCount.toLocaleString()} in total).
        </p>
      )}
    </div>
  );
}
