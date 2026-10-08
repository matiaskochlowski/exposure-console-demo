# ADR 0003 — Model output and scanner output are untrusted input

**Status:** accepted

**Context.** Scanner output can carry attacker-controlled text (banners, titles, headers). The model
reads it, so the model's output can carry it too.

**Decision.**

- Scanner text renders only as a text node (`<pre>`), never HTML or markdown.
- Model text renders via `SafeMarkdown`: `skipHtml`, no images, `https:`-only links with
  `rel="noopener noreferrer nofollow"`. `dangerouslySetInnerHTML` is banned by lint.
- Tool calls are proposals: validated with the shared Zod schemas, bound to the finding under
  discussion, executed only after human approval with re-validation.
- Prompt-injection detection is a UI warning, never a gate.
- A strict CSP backs this up (`vercel.json`).

**Consequences.** Some rich formatting (images, raw HTML tables) is unavailable in answers — acceptable
for a security tool.
