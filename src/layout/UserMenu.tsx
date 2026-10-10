import { ChevronsUpDown, Code, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { cx, Tooltip } from '../ui/index.js';
import { setTheme, useTheme, type Theme } from './theme.js';

/** Demo identity. There is no sign-in: this only shows where an account menu would live. */
const USER = {
  name: 'Sam Rivera',
  email: 'sam@northwind-security.example',
  role: 'Security analyst',
};
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: Monitor, light: Sun, dark: Moon } satisfies Record<Theme, unknown>;

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

function Avatar() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cta text-xs font-bold text-cta-fg"
    >
      {initials(USER.name)}
    </span>
  );
}

const itemClass =
  'flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm font-medium text-fg hover:bg-surface-2 focus-visible:outline-offset-[-2px]';

/**
 * Account menu in the sidebar footer: who is signed in, plus theme, reset and source. A disclosure
 * (button + panel of buttons/links), light-dismissed by outside click and Escape.
 */
export function UserMenu({
  collapsed,
  onReset,
  sourceUrl,
}: {
  collapsed: boolean;
  onReset: () => void;
  sourceUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const ThemeIcon = ICON[theme];
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The sidebar scrolls, so the panel is fixed-positioned from the trigger's rectangle.
  useLayoutEffect(() => {
    const el = panel.current;
    const anchor = trigger.current?.getBoundingClientRect();
    if (!open || !el || !anchor) return;
    el.style.left = `${Math.round(anchor.left)}px`;
    el.style.bottom = `${Math.round(window.innerHeight - anchor.top + 6)}px`;
    el.style.minWidth = `${Math.round(Math.max(anchor.width, 240))}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const button = (
    <button
      ref={trigger}
      type="button"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-label={collapsed ? `Account menu: ${USER.name}` : undefined}
      onClick={() => setOpen((o) => !o)}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-rail-hover focus-visible:outline-rail-fg',
        open && 'bg-rail-hover',
        collapsed && 'justify-center',
      )}
    >
      <Avatar />
      {!collapsed && (
        <>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-semibold">{USER.name}</span>
            <span className="truncate text-xs text-rail-muted">{USER.email}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-rail-muted" />
        </>
      )}
    </button>
  );

  return (
    <div ref={root}>
      {collapsed && !open ? (
        <Tooltip content={USER.name} side="right" className="flex w-full">
          {button}
        </Tooltip>
      ) : (
        button
      )}
      {open && (
        <div
          ref={panel}
          id={id}
          role="group"
          aria-label="Account"
          className="fixed z-40 rounded-lg border border-line bg-surface p-1 text-fg shadow-lg"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar />
            <span className="grid min-w-0 leading-tight">
              <span className="truncate text-sm font-semibold">{USER.name}</span>
              <span className="truncate text-xs text-muted">{USER.role}</span>
            </span>
          </div>
          <hr className="my-1 border-line" />
          <button type="button" className={itemClass} onClick={() => setTheme(NEXT[theme])}>
            <ThemeIcon aria-hidden="true" className="size-4 text-muted" />
            <span aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}>
              Theme: <span className="capitalize">{theme}</span>
            </span>
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onReset();
            }}
          >
            <RotateCcw aria-hidden="true" className="size-4 text-muted" />
            Reset demo
          </button>
          <a href={sourceUrl} className={itemClass}>
            <Code aria-hidden="true" className="size-4 text-muted" />
            Source
          </a>
        </div>
      )}
    </div>
  );
}
