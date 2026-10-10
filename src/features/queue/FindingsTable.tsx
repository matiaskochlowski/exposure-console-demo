import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Row } from '../../data/findings.js';
import {
  DomainBadge,
  EnvironmentBadge,
  EvidenceChip,
  PriorityBadge,
  StatusBadge,
  cx,
} from '../../ui/index.js';
import { ConceptHint } from '../concepts/ConceptHint.js';
import type { ConceptId } from '../concepts/concepts.js';
import type { Filters, SortKey } from './filters.js';

const HEADER_HEIGHT = 40;

interface FindingsTableProps {
  /** Rows on the current page. */
  rows: Row[];
  /** Index of the first row of this page within all matching rows. */
  offset: number;
  /** All rows matching the filters, across pages. */
  matchCount: number;
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
  hint,
}: {
  label: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  className?: string;
  /** Concept explained by a "What does this mean?" button next to the label. */
  hint?: ConceptId;
}) {
  const key = SORTABLE[label];
  const active = key === sort;
  return (
    <th
      scope="col"
      // The header's name is just the label: without this, screen readers would read the hint
      // button ("What does CVSS mean?") as part of every cell's column header.
      aria-label={hint ? label : undefined}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cx('px-3 text-left text-xs font-semibold text-muted', className)}
    >
      <span className="inline-flex items-center gap-0.5">
        {key ? (
          <button
            type="button"
            onClick={() => onSort(key)}
            className={cx(
              'inline-flex items-center gap-1 rounded hover:text-fg',
              active && 'text-accent',
            )}
          >
            {label}
            {dir === 'asc' && active ? (
              <ChevronUp aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronDown aria-hidden="true" className={cx('size-3.5', !active && 'opacity-0')} />
            )}
          </button>
        ) : (
          label
        )}
        {hint && <ConceptHint id={hint} />}
      </span>
    </th>
  );
}

/** Non-sortable header with a concept hint. */
function HintHeader({
  label,
  hint,
  className,
}: {
  label: string;
  hint: ConceptId;
  className: string;
}) {
  return (
    <th
      scope="col"
      aria-label={label}
      className={cx('px-3 text-left text-xs font-semibold text-muted', className)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <ConceptHint id={hint} />
      </span>
    </th>
  );
}

const FindingRow = memo(function FindingRow({
  row,
  index,
  rowIndex,
  active,
  checked,
  onToggle,
  onOpen,
  onFocusRow,
}: {
  row: Row;
  index: number;
  /** 1-based position in the whole table including the header row. */
  rowIndex: number;
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
      aria-rowindex={rowIndex}
      tabIndex={active ? 0 : -1}
      onFocus={() => onFocusRow(index)}
      onClick={() => onOpen(row.id)}
      className={cx(
        'h-14 cursor-pointer border-b border-row-line outline-none hover:bg-surface-2 [&:focus-visible>td]:bg-surface-2 [&:focus-visible>td]:shadow-[inset_0_2px_0_var(--focus),inset_0_-2px_0_var(--focus)]',
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
        <div className="truncate text-sm font-bold text-fg">
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
      <td className="hidden px-3 md:table-cell">
        <span className="inline-flex h-6 items-center rounded-sm bg-chip px-1.5 text-xs font-bold text-chip-fg tabular-nums">
          {row.riskScore.toFixed(2)}
        </span>
      </td>
      <td className="hidden px-3 text-sm tabular-nums lg:table-cell">{row.cvss.toFixed(1)}</td>
      <td className="hidden px-3 text-sm tabular-nums lg:table-cell">
        {(row.epss * 100).toFixed(1)}%
      </td>
      <td className="hidden px-3 md:table-cell">
        <div className="flex gap-1">
          {row.kev && <EvidenceChip short="KEV" label="Known exploited" />}
          {row.exploitValidated && <EvidenceChip short="Ex" label="Exploit validated" />}
        </div>
      </td>
      <td className="hidden px-3 xl:table-cell">
        <div className="flex flex-col items-start gap-0.5">
          <EnvironmentBadge environment={row.environment} />
          <DomainBadge domain={row.domain} />
        </div>
      </td>
      <td className="hidden px-3 text-sm text-muted 2xl:table-cell">{row.firstSeen}</td>
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
 * Native <table> showing one page of rows, with real table semantics (headers,
 * aria-rowcount/rowindex across pages). Rows use a roving tabindex: Tab enters the table once,
 * arrows move, Enter opens, Space selects.
 */
export function FindingsTable({
  rows,
  offset,
  matchCount,
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
    scrollRef.current
      ?.querySelector<HTMLElement>(`tr[data-index="${clamped}"]`)
      ?.focus({ preventScroll: false });
  };

  // After the drawer closes: focus the row, waiting for its page to render if it is on another one.
  const pending = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (focusRequest) pending.current = focusRequest.id;
  }, [focusRequest]);
  useEffect(() => {
    if (!pending.current) return;
    const index = rows.findIndex((r) => r.id === pending.current);
    if (index < 0) return;
    pending.current = undefined;
    focusRow(index);
    // focusRow only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, rows]);

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const row = rows[safeActive];
    const page = 10;
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

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-auto [scroll-padding-top:40px] [scroll-padding-bottom:64px]"
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
        aria-rowcount={matchCount + 1}
      >
        <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--line)]">
          <tr aria-rowindex={1} style={{ height: HEADER_HEIGHT }}>
            <th scope="col" className="w-10 px-3">
              <input
                ref={headerCheckbox}
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label={`Select all ${rows.length} findings on this page`}
                className="size-4 accent-[var(--accent)]"
              />
            </th>
            <SortHeader label="Finding" sort={sort} dir={dir} onSort={onSort} />
            <HintHeader label="Priority" hint="priority" className="w-20 sm:w-24" />
            <SortHeader
              label="Risk"
              hint="risk"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-24 md:table-cell"
            />
            <SortHeader
              label="CVSS"
              hint="cvss"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-24 lg:table-cell"
            />
            <SortHeader
              label="EPSS"
              hint="epss"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-24 lg:table-cell"
            />
            <HintHeader label="Exploitation" hint="kev" className="hidden w-28 md:table-cell" />
            <th
              scope="col"
              className="hidden w-36 px-3 text-left text-xs font-semibold text-muted xl:table-cell"
            >
              Environment / domain
            </th>
            <SortHeader
              label="First seen"
              sort={sort}
              dir={dir}
              onSort={onSort}
              className="hidden w-28 2xl:table-cell"
            />
            <HintHeader label="Status" hint="status" className="w-28 sm:w-32" />
          </tr>
        </thead>
        {/* Keyboard handling is delegated from the focusable rows (roving tabindex) to their tbody. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <tbody onKeyDown={onKeyDown}>
          {rows.map((row, index) => (
            <FindingRow
              key={row.id}
              row={row}
              index={index}
              rowIndex={offset + index + 2}
              active={index === safeActive}
              checked={selected.has(row.id)}
              onToggle={onToggle}
              onOpen={onOpen}
              onFocusRow={setActiveIndex}
            />
          ))}
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
