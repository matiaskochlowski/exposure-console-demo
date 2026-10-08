import { useMemo } from 'react';
import { useActionsState } from '../actions/store.js';
import { toRow, type Dataset, type Row } from './findings.js';

/** Base dataset with approved actions applied. Recomputed only when overrides change. */
export function useRows(dataset: Dataset): Row[] {
  const overrides = useActionsState((s) => s.overrides);
  return useMemo(() => dataset.rows.map((r) => toRow(r, overrides[r.id])), [dataset, overrides]);
}
