import { ListFilter, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  DOMAIN_LABEL,
  DOMAINS,
  ENVIRONMENT_LABEL,
  ENVIRONMENTS,
  PRIORITIES,
  STATUSES,
  STATUS_LABEL,
} from '../../shared/finding.js';
import {
  Button,
  controlClass,
  cx,
  DOMAIN_TONE,
  ENVIRONMENT_TONE,
  MultiSelect,
  PRIORITY_TONE,
  STATUS_TONE,
} from '../../ui/index.js';
import type { Filters } from './filters.js';

interface FilterBarProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>, options?: { replace?: boolean }) => void;
  onClear: () => void;
}

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p, tone: PRIORITY_TONE[p] }));
const STATUS_OPTIONS = STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
  tone: STATUS_TONE[s],
}));
const ENVIRONMENT_OPTIONS = ENVIRONMENTS.map((e) => ({
  value: e,
  label: ENVIRONMENT_LABEL[e],
  tone: ENVIRONMENT_TONE[e],
}));
const DOMAIN_OPTIONS = DOMAINS.map((d) => ({
  value: d,
  label: DOMAIN_LABEL[d],
  tone: DOMAIN_TONE[d],
}));
const SIGNAL_OPTIONS = [
  { value: 'kev', label: 'Known exploited' },
  { value: 'validated', label: 'Exploit validated' },
] as const;

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  // Local draft so typing stays instant; the URL (and the 1.2k-row filter) follows after 150 ms.
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

  const signals = [
    ...(filters.kev ? (['kev'] as const) : []),
    ...(filters.validated ? (['validated'] as const) : []),
  ];

  const active =
    filters.q ||
    filters.priority.length ||
    filters.status.length ||
    filters.env.length ||
    filters.domain.length ||
    filters.kev ||
    filters.validated;

  return (
    <div
      className="flex flex-col gap-3 border-b border-line px-4 py-3"
      role="search"
      aria-label="Filter findings"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="queue-search" className="sr-only">
          Search findings
        </label>
        <div className="relative w-full min-w-0 sm:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
          />
          <input
            ref={searchRef}
            id="queue-search"
            type="search"
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search id, title, CWE or host…"
            className={cx(controlClass, 'h-9 w-full pl-8')}
          />
        </div>
        <MultiSelect
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={filters.priority}
          onChange={(priority) => onChange({ priority })}
        />
        <MultiSelect
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.status}
          onChange={(status) => onChange({ status })}
        />
        <MultiSelect
          label="Environment"
          options={ENVIRONMENT_OPTIONS}
          selected={filters.env}
          onChange={(next) => onChange({ env: next })}
        />
        <MultiSelect
          label="Domain"
          options={DOMAIN_OPTIONS}
          selected={filters.domain}
          onChange={(domain) => onChange({ domain })}
        />
        <MultiSelect
          label="Signals"
          options={SIGNAL_OPTIONS}
          selected={signals}
          onChange={(next) =>
            onChange({ kev: next.includes('kev'), validated: next.includes('validated') })
          }
        />
        {active ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-orange!"
            onClick={() => {
              onClear();
              searchRef.current?.focus(); // the pressed button disappears
            }}
          >
            <ListFilter aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
