export const GAP = 6;
const MARGIN = 8;

/**
 * Place a top-layer popover next to an anchor, above it by default and below when there is no room,
 * clamped to the viewport. Popovers render in the top layer, so they escape overflow clipping and sit
 * above an open modal <dialog>.
 */
export function placeNear(el: HTMLElement, anchor: DOMRect, prefer: 'top' | 'bottom' = 'top') {
  const { width, height } = el.getBoundingClientRect();
  const fitsAbove = anchor.top - GAP - height >= MARGIN;
  const fitsBelow = anchor.bottom + GAP + height <= window.innerHeight - MARGIN;
  const above = prefer === 'top' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
  // Clamp vertically too: at high zoom a tall panel must stay on screen (it scrolls internally).
  const top = Math.min(
    Math.max(MARGIN, above ? anchor.top - GAP - height : anchor.bottom + GAP),
    Math.max(MARGIN, window.innerHeight - height - MARGIN),
  );
  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width / 2 - width / 2),
    window.innerWidth - width - MARGIN,
  );
  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
}

/** The Popover API is missing in jsdom and old browsers; there we fall back to `hidden`. */
export const HAS_POPOVER =
  typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
