import { useState, type ReactNode } from 'react';
import { actionsStore } from '../actions/store.ts';
import { configuredMode } from '../ai/mode.ts';
import { Badge, Button, useToast } from '../ui/index.ts';
import { RESET_EVENT } from './reset.ts';
import { ThemeToggle } from './ThemeToggle.tsx';

const INTRO_KEY = 'exposure-console:intro-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const notify = useToast();
  const [introDismissed, setIntroDismissed] = useState(readDismissed);
  const mode = configuredMode();

  const reset = () => {
    actionsStore.reset();
    window.dispatchEvent(new Event(RESET_EVENT));
    notify('Demo reset: approved actions, proposals and history cleared.');
  };

  const dismiss = () => {
    setIntroDismissed(true);
    document.getElementById('main')?.focus();
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-6" />
          <span className="font-semibold">Exposure Console</span>
        </div>
        <Badge tone="warn">Demo data</Badge>
        <Badge tone={mode === 'live' ? 'ok' : 'neutral'}>
          {mode === 'live' ? 'Live analyst' : 'Mock analyst'}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button size="sm" variant="ghost" onClick={reset}>
            Reset demo
          </Button>
          <a
            href="https://github.com/matiaskochlowski/exposure-console-demo"
            className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium hover:bg-surface-2"
          >
            Source
          </a>
        </div>
      </header>
      {!introDismissed && (
        <aside
          aria-label="About this demo"
          className="flex items-start gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-sm sm:px-6"
        >
          <p className="flex-1">
            Synthetic exposure data, no real assets. Try it: filter to <strong>P1</strong>, open a
            finding, ask the <strong>AI analyst</strong> what to do, then edit and approve (or
            reject) its proposal. Nothing runs without your approval.
          </p>
          <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Dismiss introduction">
            ×
          </Button>
        </aside>
      )}
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        {children}
      </main>
    </div>
  );
}
