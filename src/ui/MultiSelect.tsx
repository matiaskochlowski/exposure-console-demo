import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Badge, type Tone } from './Badge.js';
import { cx } from './cx.js';

export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
  /** Shows the option as a coloured pill, matching how the value appears in the table. */
  tone?: Tone;
}

/**
 * Filter dropdown: a button that opens a panel of native checkboxes (pick any number, or none).
 * A disclosure rather than an ARIA listbox: every option is a real, named checkbox, so it works with
 * a keyboard and screen reader without custom key handling. Dismissed by Escape, an outside click,
 * Tab leaving the panel, or scrolling/resizing (the panel is fixed-positioned to escape clipping).
 */
export function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<MultiSelectOption<T>>;
  selected: readonly T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panel.current;
    const anchor = trigger.current?.getBoundingClientRect();
    if (!open || !el || !anchor) return;
    const { width } = el.getBoundingClientRect();
    el.style.top = `${Math.round(anchor.bottom + 6)}px`;
    el.style.left = `${Math.round(Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)))}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const chosen = options.filter((o) => selected.includes(o.value));
  const summary =
    chosen.length === 0
      ? undefined
      : chosen.length <= 2
        ? chosen.map((o) => o.label).join(', ')
        : `${chosen.length} selected`;

  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div
      ref={root}
      className="shrink-0"
      onBlur={(event) => {
        // Tab (or focus) moving outside the control closes the panel.
        if (open && !root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors',
          summary
            ? 'border-accent bg-surface-2 font-semibold'
            : 'border-line bg-surface hover:bg-surface-2',
        )}
      >
        {/* One inline run, so the accessible name reads "Priority: P1, P2" with no stray space. */}
        <span>
          {label}
          {summary && <span className="font-normal text-muted">{`: ${summary}`}</span>}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted" />
      </button>
      {open && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- pointer-only focus guard
        <div
          ref={panel}
          id={id}
          role="group"
          aria-label={label}
          // Keep focus on the trigger while the pointer is pressed in the panel; otherwise the
          // blur (relatedTarget null) would close it before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-40 min-w-48 rounded-lg border border-line bg-surface p-1 text-fg shadow-lg"
        >
          {options.map((o) => (
            <label
              key={o.value}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm font-medium hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-4 shrink-0 items-center justify-center rounded border text-accent-fg',
                  selected.includes(o.value) ? 'border-accent bg-accent' : 'border-muted',
                )}
              >
                {selected.includes(o.value) && <Check className="size-3" />}
              </span>
              {o.tone ? <Badge tone={o.tone}>{o.label}</Badge> : o.label}
            </label>
          ))}
          {selected.length > 0 && (
            <>
              <hr className="my-1 border-line" />
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex h-9 w-full items-center rounded-md px-2 text-sm font-medium text-muted hover:bg-surface-2"
              >
                Clear {label.toLowerCase()}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
