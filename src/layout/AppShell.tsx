import {
  BookOpen,
  Code,
  History,
  LayoutDashboard,
  ListChecks,
  MessageCircleQuestion,
  PanelLeft,
  RotateCcw,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { actionsStore } from '../actions/store.js';
import { configuredMode } from '../ai/mode.js';
import { useAsk } from '../features/concepts/ask.js';
import { Badge, Button, cx, Tooltip, useToast } from '../ui/index.js';
import { RESET_EVENT } from './reset.js';
import { ThemeToggle } from './ThemeToggle.js';
import { UserMenu } from './UserMenu.js';

const INTRO_KEY = 'exposure-console:intro-dismissed';
const COLLAPSED_KEY = 'exposure-console:sidebar-collapsed';
const SOURCE_URL = 'https://github.com/matiaskochlowski/exposure-console-demo';
const SIDEBAR_ID = 'app-sidebar';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Tooltip / description, so each destination says what it is for. */
  hint: string;
  end?: boolean;
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Monitor',
    items: [
      {
        to: '/',
        label: 'Overview',
        icon: LayoutDashboard,
        hint: 'Dashboard: open exposures, trends and what to fix first',
        end: true,
      },
      {
        to: '/exposures',
        label: 'Exposures',
        icon: ListChecks,
        hint: 'The full queue: filter, sort, open a finding and ask the AI analyst',
      },
    ],
  },
  {
    group: 'Workflow',
    items: [
      {
        to: '/activity',
        label: 'Activity',
        icon: History,
        hint: 'Audit trail of every approved or rejected action',
      },
    ],
  },
  {
    group: 'Learn',
    items: [
      {
        to: '/glossary',
        label: 'Glossary',
        icon: BookOpen,
        hint: 'What CVSS, EPSS, KEV, priority and the other terms mean',
      },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

function pageTitle(pathname: string) {
  const match = ALL_ITEMS.filter((i) =>
    i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`),
  );
  return match[0]?.label ?? 'Exposure Console';
}

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Preference just won't persist.
  }
}

/** Shows a tooltip only when the label is hidden (collapsed sidebar); otherwise renders as is. */
function MaybeTooltip({
  show,
  content,
  children,
}: {
  show: boolean;
  content: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
}) {
  return show ? (
    <Tooltip content={content} side="right" className="flex w-full">
      {children}
    </Tooltip>
  ) : (
    children
  );
}

const railItem =
  'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-rail-fg focus-visible:outline-rail-fg';

/** Theme, reset and source in the mobile top bar; on desktop they live in the sidebar's UserMenu. */
function ShellControls({ onReset }: { onReset: () => void }) {
  const ask = useAsk();
  return (
    <div className="flex items-center gap-1">
      {ask && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => ask.ask('')}
          aria-label="Ask the assistant"
          className="size-8 px-0!"
        >
          <MessageCircleQuestion aria-hidden="true" className="size-4" />
        </Button>
      )}
      <ThemeToggle compact className="size-8 px-0!" />
      <Button
        size="sm"
        variant="ghost"
        onClick={onReset}
        aria-label="Reset demo"
        className="size-8 px-0!"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
      </Button>
      <a
        href={SOURCE_URL}
        aria-label="Source"
        className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-surface-2"
      >
        <Code aria-hidden="true" className="size-4" />
      </a>
    </div>
  );
}

/** Our own mark: a shield with an orange core. Decorative; the product name is always next to it. */
function Mark({ className }: { className?: string }) {
  return <img src="/favicon.svg" alt="" className={className} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const notify = useToast();
  const ask = useAsk();
  const { pathname } = useLocation();
  const [introDismissed, setIntroDismissed] = useState(() => readFlag(INTRO_KEY));
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
  const mode = configuredMode();

  // Each section is its own page: title it, and move focus to <main> when the section changes, so
  // screen readers announce the new page. Not on first load, and not for search or drawer changes.
  const section = pathname.split('/')[1] ?? '';
  const firstRender = useRef(true);
  useEffect(() => {
    document.title = `${pageTitle(pathname)} · Exposure Console`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per section, not per pathname
  }, [section]);

  const reset = () => {
    actionsStore.reset();
    window.dispatchEvent(new Event(RESET_EVENT));
    notify('Demo reset: approved actions, proposals and history cleared.');
  };

  const dismiss = () => {
    setIntroDismissed(true);
    document.getElementById('main')?.focus();
    writeFlag(INTRO_KEY, true);
  };

  const toggleSidebar = () => {
    setCollapsed((c) => {
      writeFlag(COLLAPSED_KEY, !c);
      return !c;
    });
  };

  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {/* Not a landmark: it holds the primary nav, which is its own landmark. */}
      <div
        id={SIDEBAR_ID}
        data-testid="sidebar"
        className={cx(
          'hidden shrink-0 flex-col gap-4 overflow-y-auto border-r border-rail-line bg-rail p-3 text-rail-fg transition-[width] md:flex',
          collapsed ? 'w-18' : 'w-60',
        )}
      >
        <div
          className={cx(
            'flex items-center gap-2.5 rounded-lg p-1.5',
            collapsed && 'justify-center',
          )}
        >
          <Mark className="size-9 shrink-0 rounded-lg ring-1 ring-rail-line" />
          {!collapsed && (
            <span className="grid min-w-0 leading-tight">
              <span className="truncate font-bold">Exposure Console</span>
              <span className="truncate text-xs text-rail-muted">Northwind Security</span>
            </span>
          )}
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-4">
          {NAV.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-1">
              <p className={cx('px-3 text-xs font-medium text-rail-muted', collapsed && 'sr-only')}>
                {group}
              </p>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <MaybeTooltip show={collapsed} content={`${item.label}: ${item.hint}`}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          cx(
                            railItem,
                            collapsed && 'justify-center px-0',
                            // Active page: filled and bolder; NavLink also sets aria-current.
                            isActive ? 'bg-rail-active font-semibold' : 'hover:bg-rail-hover',
                          )
                        }
                      >
                        <item.icon aria-hidden="true" className="size-4 shrink-0" />
                        <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
                      </NavLink>
                    </MaybeTooltip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-rail-line pt-3">
          {ask && (
            <MaybeTooltip show={collapsed} content="Ask what a term means, like EPSS or KEV">
              <button
                type="button"
                onClick={() => ask.ask('')}
                className={cx(railItem, 'hover:bg-rail-hover', collapsed && 'justify-center px-0')}
              >
                <MessageCircleQuestion aria-hidden="true" className="size-4 shrink-0" />
                <span className={collapsed ? 'sr-only' : undefined}>Ask the assistant</span>
              </button>
            </MaybeTooltip>
          )}
          <UserMenu collapsed={collapsed} onReset={reset} sourceUrl={SOURCE_URL} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            {/* Wrapper carries `hidden`: cx doesn't merge, so it can't override Button's inline-flex. */}
            <span className="hidden md:inline-flex">
              <Tooltip content={collapsed ? 'Show labels in the sidebar' : 'Collapse to icons'}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleSidebar}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="size-8 px-0!"
                >
                  <PanelLeft aria-hidden="true" className="size-4" />
                </Button>
              </Tooltip>
            </span>
            <span aria-hidden="true" className="hidden h-5 w-px bg-line md:block" />
            <div className="flex items-center gap-2">
              <Mark className="size-6 md:hidden" />
              <span className="font-bold md:hidden">Exposure Console</span>
              <span className="hidden font-semibold md:inline">{pageTitle(pathname)}</span>
            </div>
            <Badge tone="warn">Demo data</Badge>
            <Badge tone={mode === 'live' ? 'ok' : 'neutral'}>
              {mode === 'live' ? 'Live analyst' : 'Mock analyst'}
            </Badge>
            <div className="ml-auto md:hidden">
              <ShellControls onReset={reset} />
            </div>
          </div>
          {/* Mobile navigation: the sidebar is hidden below md. */}
          <nav aria-label="Primary" className="overflow-x-auto px-2 pb-2 md:hidden">
            <ul className="flex gap-1">
              {ALL_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap',
                        isActive
                          ? 'bg-surface-2 text-accent shadow-[inset_0_-2px_0_var(--accent)]'
                          : 'text-fg hover:bg-surface-2',
                      )
                    }
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        {!introDismissed && (
          <aside
            aria-label="About this demo"
            className="flex items-start gap-3 border-b border-l-4 border-b-line border-l-accent bg-surface-2 px-4 py-2.5 text-sm sm:px-6"
          >
            <p className="flex-1">
              Synthetic exposure data, no real assets. Start on the <strong>Overview</strong>, open
              a finding from <strong>Fix first</strong>, ask the <strong>AI analyst</strong> what to
              do, then edit and approve (or reject) its proposal. Nothing runs without your
              approval. Hover or tap any <strong>(?)</strong> to learn what a term means.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              aria-label="Dismiss introduction"
              className="size-8 px-0!"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </aside>
        )}
        <main
          id="main"
          tabIndex={-1}
          // `relative` contains the absolutely positioned sr-only text, which would otherwise extend the page.
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
