import { Send, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, cx, inputClass } from '../../ui/index.js';
import { AskContext, type AskTarget } from '../concepts/ask.js';
import type { ConceptId } from '../concepts/concepts.js';
import { answerLocally } from './answer.js';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  conceptId?: ConceptId;
}

const SUGGESTIONS = [
  'What is EPSS?',
  'How is the risk score calculated?',
  'What does KEV mean?',
  'Why is something P1?',
];

/**
 * App-wide "Ask" launcher and concepts chat. Provides the default AskContext, so every
 * "What does this mean?" popover can hand its question here.
 */
export function ConceptChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  // Whatever opened the chat (a hint, a glossary button, the sidebar): focus goes back there on close.
  const opener = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const headingId = useId();

  const submit = useCallback((text: string) => {
    const question = text.trim().slice(0, 500);
    if (!question) return;
    const answer = answerLocally(question);
    setMessages((m) => [
      ...m,
      { id: nextId.current++, role: 'user', text: question },
      { id: nextId.current++, role: 'assistant', ...answer },
    ]);
    setDraft('');
  }, []);

  const rememberOpener = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !panel.current?.contains(active)) opener.current = active;
  };

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Native modal <dialog>: showModal() gives a focus trap, an inert page behind and Escape (cancel).
  useEffect(() => {
    const dialog = panel.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    input.current?.focus();
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      // Only once the page is no longer inert behind the modal can focus go back to the opener.
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, [open, close]);

  const lastAnswer = messages.findLast((m) => m.role === 'assistant')?.text ?? '';

  const target = useMemo<AskTarget>(
    () => ({
      label: 'Ask the assistant',
      ask: (question) => {
        rememberOpener();
        setOpen(true);
        submit(question);
        // Also when the chat was already open, so the person can keep typing.
        requestAnimationFrame(() => input.current?.focus());
      },
    }),
    [submit],
  );

  return (
    <AskContext value={target}>
      {children}
      {/* Always mounted, so even the first answer (asked while the panel opens) is announced. */}
      <p role="status" className="sr-only">
        {lastAnswer}
      </p>
      {open && (
        // Backdrop click is a mouse convenience; the keyboard equivalent is Escape (native cancel).
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <dialog
          id={panelId}
          aria-labelledby={headingId}
          ref={panel}
          className="m-auto max-h-[min(560px,calc(100dvh-2rem))] w-[min(32rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:backdrop-blur-sm open:flex"
          onMouseDown={(event) => {
            pressedOnBackdrop.current = event.target === event.currentTarget;
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && pressedOnBackdrop.current) close();
            pressedOnBackdrop.current = false;
          }}
        >
          <header className="flex items-start gap-2 border-b-2 border-accent px-4 py-3">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 text-accent" />
            <div className="flex-1">
              <h2 id={headingId} className="font-bold">
                Ask the assistant
              </h2>
              <p className="text-xs text-muted">
                Explains the concepts in this console. Answers come from the built-in glossary;
                nothing you type leaves your browser.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={close}
              aria-label="Close assistant"
              className="size-8 px-0!"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </header>
          <ol
            aria-label="Conversation"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 && (
              <li className="text-sm text-muted">
                Ask what a term means, like EPSS or risk accepted. To ask about a specific finding,
                open it from Exposures and use its AI analyst.
              </li>
            )}
            {messages.map((m) => (
              <li key={m.id} className={cx('flex flex-col', m.role === 'user' && 'items-end')}>
                <p
                  className={cx(
                    'max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                    m.role === 'user' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg',
                  )}
                >
                  <span className="sr-only">
                    {m.role === 'user' ? 'You asked: ' : 'Assistant: '}
                  </span>
                  {m.text}
                </p>
                {m.conceptId && (
                  <Link
                    to={`/glossary#${m.conceptId}`}
                    className="mt-1 text-xs font-semibold text-accent underline"
                  >
                    Open in glossary
                  </Link>
                )}
              </li>
            ))}
          </ol>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    submit(s);
                    input.current?.focus(); // suggestion buttons disappear after the first question
                  }}
                  className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-accent hover:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
              // Send disables itself once the draft clears; keep focus in the panel so Escape works.
              input.current?.focus();
            }}
          >
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask about a concept
            </label>
            <input
              ref={input}
              id={`${panelId}-input`}
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about a concept…"
              className={cx(inputClass, 'h-9 flex-1')}
            />
            <Button
              type="submit"
              variant="accent"
              size="sm"
              disabled={!draft.trim()}
              className="h-9"
            >
              <Send aria-hidden="true" className="size-4" />
              Send
            </Button>
          </form>
        </dialog>
      )}
    </AskContext>
  );
}
