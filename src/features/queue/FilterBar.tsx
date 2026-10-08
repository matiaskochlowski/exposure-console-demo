import { useEffect, useRef, useState } from 'react';
import { ENVIRONMENTS, PRIORITIES, STATUSES, STATUS_LABEL } from '../../shared/finding.js';
import { Button, controlClass, cx } from '../../ui/index.js';
import type { Filters } from './filters.js';

interface FilterBarProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>, options?: { replace?: boolean }) => void;
  onClear: () => void;
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'h-8 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
        pressed
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line bg-surface text-fg hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  // Local draft so typing stays instant; the URL (and the 10k-row filter) follows after 150 ms.
  const [draft, setDraft] = useState(filters.q);
  const committed = useRef(filters.q);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Back/forward or "clear filters" changed the URL: reflect it in the box.
    if (filters.q !== committed.current) {
      committed.current = filters.q;
      setDraft(filters.q);
    }
  }, [filters.q]);

  useEffect(() => {
    if (draft.trim() === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = draft.trim();
      onChange({ q: draft.trim() }, { replace: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, onChange]);

  const active =
    filters.q ||
    filters.priority.length ||
    filters.status.length ||
    filters.env.length ||
    filters.kev ||
    filters.validated;

  return (
    <div
      className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6"
      role="search"
      aria-label="Filter findings"
    >
      <div className="flex items-center gap-2">
        <label htmlFor="queue-search" className="sr-only">
          Search findings
        </label>
        <input
          ref={searchRef}
          id="queue-search"
          type="search"
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search id, title, CWE or host…"
          className={cx(controlClass, 'h-9 min-w-0 flex-1 sm:max-w-md')}
        />
        <select
          aria-label="Environment"
          value={filters.env[0] ?? ''}
          onChange={(e) =>
            onChange({ env: e.target.value ? [e.target.value as Filters['env'][number]] : [] })
          }
          className={cx(controlClass, 'h-9 w-32 shrink-0 sm:w-auto')}
        >
          <option value="">All environments</option>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {env[0]!.toUpperCase() + env.slice(1)}
            </option>
          ))}
        </select>
        {active ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onClear();
              searchRef.current?.focus(); // the pressed button disappears
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <fieldset className="flex shrink-0 items-center gap-1.5 sm:flex-wrap">
          <legend className="sr-only">Priority</legend>
          {PRIORITIES.map((p) => (
            <Chip
              key={p}
              pressed={filters.priority.includes(p)}
              onClick={() => onChange({ priority: toggle(filters.priority, p) })}
            >
              {p}
            </Chip>
          ))}
        </fieldset>
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <fieldset className="flex shrink-0 items-center gap-1.5 sm:flex-wrap">
          <legend className="sr-only">Status</legend>
          {STATUSES.map((s) => (
            <Chip
              key={s}
              pressed={filters.status.includes(s)}
              onClick={() => onChange({ status: toggle(filters.status, s) })}
            >
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </fieldset>
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Chip pressed={filters.kev} onClick={() => onChange({ kev: !filters.kev })}>
          Known exploited
        </Chip>
        <Chip
          pressed={filters.validated}
          onClick={() => onChange({ validated: !filters.validated })}
        >
          Exploit validated
        </Chip>
      </div>
    </div>
  );
}
