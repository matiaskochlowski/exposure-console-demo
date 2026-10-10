import { BookOpen, CircleHelp, Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { cx, HAS_POPOVER, placeNear, Tooltip } from '../../ui/index.js';
import { useAsk } from './ask.js';
import { CONCEPT_BY_ID, type ConceptId } from './concepts.js';

/**
 * "What does this mean?" for a term: a (?) button with a one-line tooltip on hover/focus, and a
 * click-to-open explanation with "Ask about this" and a link to the glossary.
 */
export function ConceptHint({
  id,
  question,
  className,
}: {
  id: ConceptId;
  /** What "Ask about this" sends; defaults to "What is <term>?". */
  question?: string;
  className?: string;
}) {
  const concept = CONCEPT_BY_ID[id];
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Only used without the Popover API (jsdom); real browsers toggle natively via popoverTarget.
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const ask = useAsk();
  const [open, setOpen] = useState(false);

  // The panel is placed once; hide it when anything scrolls rather than let it drift from its (?).
  useEffect(() => {
    if (!open || !HAS_POPOVER) return;
    const hide = () => panel.current?.hidePopover();
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [open]);

  const close = () => {
    if (HAS_POPOVER) panel.current?.hidePopover();
    else setFallbackOpen(false);
  };

  return (
    <>
      <Tooltip content={concept.short}>
        <button
          ref={button}
          type="button"
          aria-label={`What does ${concept.term} mean?`}
          popoverTarget={HAS_POPOVER ? panelId : undefined}
          aria-expanded={HAS_POPOVER ? undefined : fallbackOpen}
          onClick={HAS_POPOVER ? undefined : () => setFallbackOpen((o) => !o)}
          className={cx(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-accent',
            className,
          )}
        >
          <CircleHelp aria-hidden="true" className="size-3.5" />
        </button>
      </Tooltip>
      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={concept.term}
        hidden={!HAS_POPOVER && !fallbackOpen}
        onToggle={(e) => {
          const isOpen = (e as unknown as ToggleEvent).newState === 'open';
          setOpen(isOpen);
          if (isOpen && button.current && panel.current) {
            placeNear(panel.current, button.current.getBoundingClientRect(), 'bottom');
            // It is a dialog: move focus in. Escape or light dismiss returns it to the (?) button.
            panel.current.querySelector<HTMLElement>('button, a')?.focus({ preventScroll: true });
          }
        }}
        className="m-0 max-h-[calc(100dvh-16px)] w-80 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-line bg-surface p-4 text-left text-sm font-normal text-fg shadow-xl [inset:auto]"
      >
        <p className="flex items-center gap-1.5 font-bold">
          <CircleHelp aria-hidden="true" className="size-4 text-accent" />
          {concept.term}
        </p>
        <p className="mt-2 leading-relaxed text-muted">{concept.long}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ask && (
            <button
              type="button"
              onClick={() => {
                close();
                ask.ask(question ?? `What is ${concept.term}?`);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-sm font-semibold text-accent-fg hover:opacity-90"
            >
              <Sparkles aria-hidden="true" className="size-4" />
              {ask.label}
            </button>
          )}
          <Link
            to={`/glossary#${concept.id}`}
            onClick={close}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-surface-2"
          >
            <BookOpen aria-hidden="true" className="size-4" />
            Glossary
          </Link>
        </div>
      </div>
    </>
  );
}
