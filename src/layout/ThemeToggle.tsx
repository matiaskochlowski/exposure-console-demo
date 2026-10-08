import { useEffect, useState } from 'react';
import { Button } from '../ui/index.ts';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'exposure-console:theme';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Preference just won't persist.
    }
  }, [theme]);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</span>
      <span className="hidden capitalize sm:inline">{theme}</span>
    </Button>
  );
}
