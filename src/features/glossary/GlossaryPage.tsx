import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Card } from '../../ui/index.js';
import { useAsk } from '../concepts/ask.js';
import { CONCEPT_BY_ID, CONCEPTS } from '../concepts/concepts.js';

/** Every concept the console uses, in plain language, each with a one-click question for the assistant. */
export default function GlossaryPage() {
  const ask = useAsk();
  const { hash } = useLocation();

  // Deep links like /glossary#epss: scroll to and focus the term. The hash is untrusted: only real
  // concept ids are targets, and a malformed escape must not throw (security-reviewer finding).
  let key: string | undefined;
  try {
    key = decodeURIComponent(hash.slice(1));
  } catch {
    key = undefined;
  }
  const activeId = key && Object.hasOwn(CONCEPT_BY_ID, key) ? key : undefined;

  useEffect(() => {
    const el = activeId ? document.getElementById(activeId) : null;
    el?.scrollIntoView({ block: 'start' });
    el?.focus({ preventScroll: true });
  }, [activeId]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Glossary</h1>
        <p className="max-w-2xl text-sm text-muted">
          The terms behind the numbers. Exposure management ranks vulnerabilities by how likely they
          are to be used against you, not by severity alone; these are the signals it uses.
        </p>
      </div>
      <Card>
        <dl className="divide-y divide-row-line">
          {CONCEPTS.map((c) => (
            <div
              key={c.id}
              id={c.id}
              tabIndex={-1}
              // Highlighted from the URL hash (`:target` doesn't follow client-side navigation), with
              // an accent edge so it isn't colour-only.
              data-active={c.id === activeId || undefined}
              className="scroll-mt-4 px-5 py-4 outline-offset-[-2px] data-active:bg-surface-2 data-active:shadow-[inset_4px_0_0_var(--accent)]"
            >
              <dt className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{c.term}</span>
                {ask && (
                  <button
                    type="button"
                    onClick={() => ask.ask(`What does ${c.term} mean?`)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-surface-2"
                  >
                    <Sparkles aria-hidden="true" className="size-3.5" />
                    Ask about {c.term}
                  </button>
                )}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-fg">{c.short}</dd>
              <dd className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{c.long}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
