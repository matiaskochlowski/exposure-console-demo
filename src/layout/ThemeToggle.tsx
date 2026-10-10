import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../ui/index.js';
import { applyTheme, setTheme, useTheme, type Theme } from './theme.js';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: Monitor, light: Sun, dark: Moon } satisfies Record<Theme, unknown>;

/** `compact` drops the visible label (the rail); the accessible name always states the theme. */
export function ThemeToggle({
  compact = false,
  className,
  'aria-describedby': describedBy,
}: {
  compact?: boolean;
  className?: string;
  /** Set by a wrapping Tooltip. */
  'aria-describedby'?: string;
}) {
  const theme = useTheme();
  useEffect(() => applyTheme(theme), [theme]);
  const Icon = ICON[theme];
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      title={describedBy ? undefined : `Theme: ${theme}`}
      aria-describedby={describedBy}
      className={className}
    >
      <Icon aria-hidden="true" className="size-4" />
      {!compact && <span className="hidden capitalize sm:inline">{theme}</span>}
    </Button>
  );
}
