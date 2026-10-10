import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'exposure-console:theme';

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * One theme for the whole app. The toggle is rendered twice (sidebar and mobile top bar), so the
 * value lives here rather than in component state, or the two copies drift apart.
 */
let current: Theme = readTheme();
const listeners = new Set<() => void>();

export function setTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Preference just won't persist.
  }
  for (const listener of listeners) listener();
}

/** Mirror the theme onto <html data-theme>; "system" defers to prefers-color-scheme. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
