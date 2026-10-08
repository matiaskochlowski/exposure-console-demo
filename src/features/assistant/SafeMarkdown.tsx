import Markdown, { type Components } from 'react-markdown';
import { safeUrl } from './safeUrl.ts';

/**
 * Renders model output. Model text is untrusted (ADR 0003):
 * - raw HTML in the markdown is dropped (skipHtml), never parsed;
 * - images are not rendered (no tracking pixels / exfiltration via URLs);
 * - links survive only with an https: URL, open in a new tab without opener access.
 */
const components: Components = {
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-accent underline"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 rounded-md bg-warn-soft px-3 py-2 text-warn">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-2 px-1 font-mono text-[0.85em]">{children}</code>
  ),
};

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      skipHtml
      disallowedElements={['img']}
      unwrapDisallowed
      urlTransform={safeUrl}
      components={components}
    >
      {children}
    </Markdown>
  );
}
