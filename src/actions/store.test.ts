import { describe, expect, it, vi } from 'vitest';
import { generateFindings } from '../shared/generate.js';
import { createActionsStore } from './store.js';
import { EMPTY_STATE } from './types.js';

const base = { ...generateFindings(1)[0]!, status: 'open' as const };

describe('actions store', () => {
  it('persists every change and notifies subscribers', () => {
    const persist = vi.fn();
    const store = createActionsStore(EMPTY_STATE, persist);
    const listener = vi.fn();
    store.subscribe(listener);
    store.propose({
      proposalId: 'p-1',
      requestId: 'req-00000001',
      findingId: base.id,
      call: {
        name: 'set_priority',
        args: { findingId: base.id, priority: 'P1', reason: 'Internet facing' },
      },
    });
    store.approve('p-1', () => base);
    expect(store.getState().overrides[base.id]?.priority).toBe('P1');
    expect(persist).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('resets to an empty state', () => {
    const store = createActionsStore(
      { ...EMPTY_STATE, overrides: { x: { status: 'resolved' } } },
      () => {},
    );
    store.reset();
    expect(store.getState()).toEqual(EMPTY_STATE);
  });

  it('falls back to an empty state when storage is unavailable or corrupt', async () => {
    localStorage.setItem('exposure-console:actions:v1', '{corrupt');
    vi.resetModules();
    const { actionsStore } = await import('./store.js');
    expect(actionsStore.getState()).toEqual(EMPTY_STATE);
  });
});

describe('parseActionsState', () => {
  it.each([
    ['{"overrides":null}'],
    ['{"overrides":{},"proposals":{"x":{"state":"weird"}},"audit":[],"nextTicket":1001}'],
    ['{"overrides":{"a":{"status":"deleted"}},"proposals":{},"audit":[],"nextTicket":1001}'],
    ['[]'],
  ])('falls back to empty for invalid stored state %s', async (raw) => {
    const { parseActionsState } = await import('./schema.js');
    expect(parseActionsState(raw)).toEqual(EMPTY_STATE);
  });

  it.each([
    ['findingId', { at: '2026-01-01T00:00:00.000Z', findingId: 'x'.repeat(5000) }],
    ['at', { at: '9'.repeat(5000), findingId: 'DEMO-2026-00001' }],
  ])('rejects an oversized audit %s (it would bloat the Activity page)', async (_, fields) => {
    const { parseActionsState } = await import('./schema.js');
    const raw = JSON.stringify({
      ...EMPTY_STATE,
      audit: [{ ...fields, summary: 's', actor: 'you' }],
    });
    expect(parseActionsState(raw)).toEqual(EMPTY_STATE);
  });

  it('accepts a valid stored state', async () => {
    const { parseActionsState } = await import('./schema.js');
    const valid = {
      ...EMPTY_STATE,
      overrides: { 'DEMO-2026-00001': { status: 'in_progress', ticketId: 'SIM-1001' } },
      nextTicket: 1002,
    };
    expect(parseActionsState(JSON.stringify(valid))).toEqual(valid);
  });
});
