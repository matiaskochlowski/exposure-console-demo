import { useSyncExternalStore } from 'react';
import type { ActionCall } from '../shared/actions.ts';
import type { Finding } from '../shared/finding.ts';
import { addProposal, approveProposal, rejectProposal, type ExecuteResult } from './executor.ts';
import { parseActionsState } from './schema.ts';
import { EMPTY_STATE, type ActionsState } from './types.ts';

const STORAGE_KEY = 'exposure-console:actions:v1';

function load(): ActionsState {
  try {
    return parseActionsState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_STATE; // storage blocked
  }
}

function save(state: ActionsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota: the demo still works, it just won't survive a reload.
  }
}

/** Tiny external store: reducer-style transitions from executor.ts, persisted to localStorage. */
export function createActionsStore(initial: ActionsState = load(), persist = save) {
  let state = initial;
  const listeners = new Set<() => void>();
  const set = (next: ActionsState) => {
    if (next === state) return;
    state = next;
    persist(state);
    listeners.forEach((l) => l());
  };
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    propose(input: { proposalId: string; requestId: string; findingId: string; call: ActionCall }) {
      set(addProposal(state, input));
    },
    reject(proposalId: string) {
      set(rejectProposal(state, proposalId));
    },
    approve(
      proposalId: string,
      getBase: (id: string) => Finding | undefined,
      editedArgs?: unknown,
    ): ExecuteResult {
      const result = approveProposal(state, proposalId, getBase, editedArgs);
      set(result.state);
      return result;
    },
    reset() {
      set(EMPTY_STATE);
    },
    /** Adopt state written elsewhere (another tab) without persisting it back. */
    replace(next: ActionsState) {
      if (next === state) return;
      state = next;
      listeners.forEach((l) => l());
    },
  };
}

export type ActionsStore = ReturnType<typeof createActionsStore>;

export const actionsStore = createActionsStore();

// Another tab changed the persisted state: adopt it, so tabs don't overwrite each other's actions or
// reuse ticket numbers. (The storage event only fires in the *other* tabs.)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) actionsStore.replace(load());
  });
}

export function useActionsState<T>(
  selector: (s: ActionsState) => T,
  store: ActionsStore = actionsStore,
): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
