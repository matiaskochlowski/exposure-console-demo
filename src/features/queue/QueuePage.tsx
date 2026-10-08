import { use, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router';
import { loadDataset } from '../../data/findings.js';
import { useRows } from '../../data/useRows.js';
import { Button } from '../../ui/index.js';
import { RESET_EVENT } from '../../layout/reset.js';
import { toCsv } from './csv.js';
import { FilterBar } from './FilterBar.js';
import {
  DEFAULT_FILTERS,
  parseFilters,
  selectRows,
  serializeFilters,
  type Filters,
  type SortKey,
} from './filters.js';
import { FindingsTable } from './FindingsTable.js';

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function QueuePage() {
  const dataset = use(loadDataset());
  const all = useRows(dataset);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openMatch = useMatch('/findings/:id');
  const openId = openMatch?.params.id;

  const paramsKey = searchParams.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => parseFilters(searchParams), [paramsKey]);
  // Typing and chip clicks render immediately; the 10k-row filter/sort follows as a deferred render.
  const deferredFilters = useDeferredValue(filters);
  const rows = useMemo(() => selectRows(all, deferredFilters), [all, deferredFilters]);
  const stale = deferredFilters !== filters;

  const update = useCallback(
    (patch: Partial<Filters>, options: { replace?: boolean } = {}) => {
      setSearchParams((prev) => serializeFilters({ ...parseFilters(prev), ...patch }), {
        replace: options.replace,
      });
    },
    [setSearchParams],
  );

  const onSort = useCallback(
    (key: SortKey) =>
      update(
        filters.sort === key
          ? { dir: filters.dir === 'desc' ? 'asc' : 'desc' }
          : { sort: key, dir: 'desc' },
      ),
    [filters.sort, filters.dir, update],
  );

  // Selection is by stable id, so it survives filter changes; "select all" means all rows matching now.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const onToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const onToggleAll = useCallback(
    (select: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of rows) {
          if (select) next.add(r.id);
          else next.delete(r.id);
        }
        return next;
      });
    },
    [rows],
  );
  useEffect(() => {
    const clear = () => setSelected(new Set());
    window.addEventListener(RESET_EVENT, clear);
    return () => window.removeEventListener(RESET_EVENT, clear);
  }, []);

  const onOpen = useCallback(
    (id: string) => navigate({ pathname: `/findings/${id}`, search: location.search }),
    [navigate, location.search],
  );

  // When the drawer closes, scroll back to and focus the row it was opened from.
  const [focusRequest, setFocusRequest] = useState<{ id: string }>();
  const lastOpen = useRef<string | undefined>(openId);
  useEffect(() => {
    if (lastOpen.current && !openId) setFocusRequest({ id: lastOpen.current });
    lastOpen.current = openId;
  }, [openId]);

  const exportRef = useRef<HTMLButtonElement>(null);
  const hiddenSelected = selected.size - rows.reduce((n, r) => n + (selected.has(r.id) ? 1 : 0), 0);

  const exportCsv = () => {
    const source = selected.size ? all.filter((r) => selected.has(r.id)) : rows;
    download(`findings-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(source));
  };

  const sortLabel = {
    risk: 'risk',
    cvss: 'CVSS',
    epss: 'EPSS',
    firstSeen: 'first seen',
    id: 'finding id',
  }[filters.sort];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold">Exposure queue</h1>
          <p className="text-sm text-muted" aria-hidden="true">
            {rows.length.toLocaleString()} of {all.length.toLocaleString()} findings · sorted by{' '}
            {sortLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted">
                {selected.size.toLocaleString()} selected
                {hiddenSelected > 0 && ` (${hiddenSelected.toLocaleString()} hidden by filters)`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(new Set());
                  exportRef.current?.focus(); // the pressed button disappears
                }}
              >
                Clear selection
              </Button>
            </>
          )}
          <Button ref={exportRef} size="sm" onClick={exportCsv}>
            Export {selected.size ? 'selected' : 'filtered'} CSV
          </Button>
        </div>
      </div>
      <FilterBar
        filters={filters}
        onChange={update}
        onClear={() => setSearchParams(serializeFilters(DEFAULT_FILTERS))}
      />
      <p role="status" className="sr-only">
        {selected.size ? `${selected.size.toLocaleString()} findings selected` : ''}
      </p>
      {/* One polite announcement per settled result, instead of on every keystroke. */}
      <div role="status" aria-live="polite" className="sr-only">
        {stale
          ? ''
          : `${rows.length.toLocaleString()} findings, sorted by ${sortLabel}, ${filters.dir === 'desc' ? 'descending' : 'ascending'}.`}
      </div>
      <div
        className={
          stale
            ? 'flex min-h-0 flex-1 flex-col opacity-70 transition-opacity'
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        <FindingsTable
          rows={rows}
          totalCount={all.length}
          selected={selected}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          onOpen={onOpen}
          sort={filters.sort}
          dir={filters.dir}
          onSort={onSort}
          focusRequest={focusRequest}
        />
      </div>
      <Outlet />
    </div>
  );
}
