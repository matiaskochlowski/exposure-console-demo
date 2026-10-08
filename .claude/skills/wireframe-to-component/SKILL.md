---
name: wireframe-to-component
description: Turn a wireframe (image in docs/wireframes/ or a described layout) into React components built from src/ui primitives, with tests. Use when implementing a new screen or panel from a sketch.
---

# Wireframe → component

1. **Read the wireframe** (`docs/wireframes/*.png|svg|md`) and list every region, control and state
   (empty, loading, error, long text, mobile). Ask about anything ambiguous before writing code.
2. **Map to existing primitives first** — open `src/ui/index.ts`. Reuse `Button`, `Badge`,
   `SeverityBadge`, `Drawer`, `Dialog`, `Toast`, `Field`. Only add a primitive when two or more
   screens need it; put it in `src/ui/` with a test.
3. **Tokens only** — colours, radius and spacing come from the CSS variables in `src/index.css`
   (`bg-surface`, `text-muted`, `border-line`…). No hex values in components.
4. **Semantics before ARIA** — native `<button>`, `<table>`, `<label>`, headings in order. Add ARIA
   only when no native element fits (see `docs/conventions.md#accessibility`).
5. **Responsive** — design mobile first at 360px; verify at 360, 768 and 1280.
6. **Tests** — at least one RTL test per interactive behaviour, queried by role/name (follow the
   `write-tests` skill).
7. **Report** — list which wireframe regions map to which components, and any deviations with the
   reason, so a designer can review.
