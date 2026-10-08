import { useMemo } from 'react';
import type { Dataset } from '../data/findings.js';
import { configuredMode, createProvider } from './mode.js';

export function useAssistantProvider(dataset: Dataset) {
  return useMemo(() => createProvider(configuredMode(), (id) => dataset.byId.get(id)), [dataset]);
}
