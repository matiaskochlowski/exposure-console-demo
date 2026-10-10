import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { GAP, HAS_POPOVER, placeNear } from './popover.js';

type Trigger = ReactElement<{ 'aria-describedby'?: string }>;

/**
 * Hover/focus tooltip for a focusable trigger (WCAG 1.4.13): shows on hover or keyboard focus, stays
 * while the pointer moves onto it, Escape dismisses it. Supplementary text only: the trigger keeps its
 * own accessible name, the tooltip is wired up as its description.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode;
  children: Trigger;
  side?: 'top' | 'bottom' | 'right';
  /** Classes for the wrapper, e.g. `flex w-full` so a full-width trigger keeps its width. */
  className?: string;
}) {
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  // Hover and focus are tracked separately, so the pointer leaving doesn't hide the tooltip of a
  // trigger that still has keyboard focus (WCAG 1.4.13 "persistent"). Escape, click and scroll
  // dismiss it until the next hover or focus.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;

  const hover = () => {
    window.clearTimeout(hideTimer.current);
    setHovered(true);
    setDismissed(false);
  };
  // A short delay lets the pointer travel from the trigger onto the tooltip.
  const unhoverSoon = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHovered(false), 120);
  };
  const hideNow = () => {
    window.clearTimeout(hideTimer.current);
    setDismissed(true);
  };

  useLayoutEffect(() => {
    const el = tip.current;
    const anchor = wrapper.current?.firstElementChild;
    if (!HAS_POPOVER || !el || !anchor) return;
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover();
      return;
    }
    el.showPopover();
    const rect = anchor.getBoundingClientRect();
    if (side === 'right') {
      const { height } = el.getBoundingClientRect();
      el.style.left = `${Math.round(rect.right + GAP)}px`;
      el.style.top = `${Math.round(rect.top + rect.height / 2 - height / 2)}px`;
    } else placeNear(el, rect, side);
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      hideNow();
      // Swallow this Escape (dismiss only the tooltip, WCAG 1.4.13) only when it is plainly aimed at
      // the tooltip: focus is on its trigger and nothing newer is open on top. Otherwise it belongs
      // to the popover or modal drawer above, which must still close (code-reviewer finding).
      const focusedHere = wrapper.current?.contains(document.activeElement) ?? false;
      const overlayOnTop =
        document.querySelector(':popover-open:not([role="tooltip"])') !== null ||
        [...document.querySelectorAll('dialog')].some(
          (d) => d.matches(':modal') && !d.contains(wrapper.current),
        );
      if (focusedHere && !overlayOnTop) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
    // Fixed position goes stale when anything scrolls; hide rather than drift.
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hideNow, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hideNow, true);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  return (
    <span
      ref={wrapper}
      className={className ?? 'inline-flex'}
      onPointerEnter={hover}
      onPointerLeave={unhoverSoon}
      onFocus={() => {
        setFocused(true);
        setDismissed(false);
      }}
      onBlur={() => setFocused(false)}
      // Activating the trigger (e.g. opening a popover) dismisses the tooltip so it doesn't stack.
      onClickCapture={hideNow}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        ref={tip}
        id={id}
        role="tooltip"
        popover="manual"
        hidden={!HAS_POPOVER && !open}
        onPointerEnter={hover}
        onPointerLeave={unhoverSoon}
        className="m-0 max-w-64 rounded-md border border-line bg-fg px-2.5 py-1.5 text-left text-xs leading-snug font-normal text-surface shadow-lg [inset:auto]"
      >
        {content}
      </span>
    </span>
  );
}
