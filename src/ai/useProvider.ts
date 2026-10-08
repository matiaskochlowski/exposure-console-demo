import { useMemo } from 'react';
import type { Dataset } from '../data/findings.ts';
import { configuredMode, createProvider } from './mode.ts';

export function useAssistantProvider(dataset: Dataset) {
  return useMemo(() => createProvider(configuredMode(), (id) => dataset.byId.get(id)), [dataset]);
}
