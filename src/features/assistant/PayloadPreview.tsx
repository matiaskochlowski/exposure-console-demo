import { useEffect, useState } from 'react';
import { buildFindingContext, type ClientState, type FindingContext } from '../../shared/assist.ts';
import type { Finding } from '../../shared/finding.ts';
import { Badge } from '../../ui/index.ts';

/**
 * "What the analyst receives". In live mode this is fetched from the server, which builds the real
 * outgoing payload; in mock mode nothing leaves the browser and the same function runs locally.
 */
export function PayloadPreview({
  finding,
  clientState,
  mode,
}: {
  finding: Finding;
  clientState: ClientState;
  mode: 'mock' | 'live';
}) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<{ context?: FindingContext; error?: string }>({});
  const statusKey = `${clientState.status}|${clientState.hasTicket}|${clientState.priorityOverride ?? ''}`;

  useEffect(() => {
    if (!open || mode !== 'live') return;
    const controller = new AbortController();
    fetch('/api/assist-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId: finding.id, clientState }),
      signal: controller.signal,
    })
      .then(async (res) =>
        res.ok
          ? setRemote({ context: (await res.json()) as FindingContext })
          : setRemote({ error: `Preview unavailable (${res.status})` }),
      )
      .catch(() => controller.signal.aborted || setRemote({ error: 'Preview unavailable' }));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, finding.id, statusKey]);

  const context = mode === 'live' ? remote.context : buildFindingContext(finding, clientState);

  return (
    <details
      className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">What the analyst receives</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-xs text-muted">
          {mode === 'live'
            ? 'Built and redacted on the server: this is the exact finding context sent to the model.'
            : 'Mock mode: nothing leaves your browser. This is the context a live model would receive, built by the same code the server uses.'}
        </p>
        {remote.error && mode === 'live' && <p className="text-xs text-danger">{remote.error}</p>}
        {context && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(context.redactions).map(([kind, n]) => (
                <Badge key={kind} tone="accent">
                  {n} {kind.toLowerCase()} redacted
                </Badge>
              ))}
              {context.excludedFields.map((f) => (
                <Badge key={f}>{f} withheld</Badge>
              ))}
            </div>
            <pre className="max-h-64 overflow-auto rounded bg-surface p-2 font-mono text-xs whitespace-pre-wrap">
              {JSON.stringify(context, null, 2)}
            </pre>
          </>
        )}
      </div>
    </details>
  );
}
