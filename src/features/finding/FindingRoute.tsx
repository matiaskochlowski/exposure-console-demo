import { use, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useActionsState } from '../../actions/store.ts';
import { useAssistantProvider } from '../../ai/useProvider.ts';
import { loadDataset, toRow } from '../../data/findings.ts';
import { detectInjection } from '../../shared/detectInjection.ts';
import { Badge, Drawer, PriorityBadge, StatusBadge } from '../../ui/index.ts';
import { AssistantPanel } from '../assistant/AssistantPanel.tsx';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default function FindingRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dataset = use(loadDataset());
  const provider = useAssistantProvider(dataset);
  const override = useActionsState((s) => s.overrides[id]);
  const audit = useActionsState((s) => s.audit);
  const base = dataset.byId.get(id);
  const close = () => navigate({ pathname: '/', search: location.search });
  const getBase = (findingId: string) => dataset.byId.get(findingId);

  if (!base) {
    return (
      <Drawer title="Finding not found" onClose={close}>
        <p className="p-6 text-sm text-muted">There is no finding with id “{id}”.</p>
      </Drawer>
    );
  }

  const row = toRow(base, override);
  const injection = detectInjection(row.scannerText);
  const history = audit.filter((a) => a.findingId === row.id).reverse();

  return (
    <Drawer
      title={row.title}
      onClose={close}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono">{row.id}</span>
          <PriorityBadge priority={row.priority} overridden={row.priorityOverridden} />
          <StatusBadge status={row.effectiveStatus} />
          {row.kev && <Badge tone="danger">Known exploited</Badge>}
          {row.exploitValidated && <Badge tone="warn">Exploit validated</Badge>}
          {row.ticketId && <Badge tone="accent">{row.ticketId} (simulated)</Badge>}
        </span>
      }
    >
      <div className="flex flex-col gap-6 px-4 py-4 sm:px-6">
        <section aria-labelledby="risk-heading">
          <h3 id="risk-heading" className="text-base font-semibold">
            Why {row.priority}
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Risk score">{row.riskScore.toFixed(2)}</Stat>
            <Stat label="CVSS">{row.cvss.toFixed(1)}</Stat>
            <Stat label="EPSS">{(row.epss * 100).toFixed(2)}%</Stat>
            <Stat label="Asset criticality">{row.assetCriticality} / 4</Stat>
          </dl>
          {row.priorityOverridden && (
            <p className="mt-2 text-sm text-muted">
              Overridden from {row.computedPriority}: {row.priorityReason}
            </p>
          )}
          {row.riskAcceptedUntil && (
            <p className="mt-2 text-sm text-muted">Risk accepted until {row.riskAcceptedUntil}.</p>
          )}
        </section>

        <AssistantPanel key={row.id} row={row} provider={provider} getBase={getBase} />

        <section aria-labelledby="asset-heading">
          <h3 id="asset-heading" className="text-base font-semibold">
            Asset & evidence
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat label="Host">
              <span className="font-mono break-all">{row.hostname}</span>
            </Stat>
            <Stat label="IP">
              <span className="font-mono">{row.ip}</span>
            </Stat>
            <Stat label="Environment">{row.environment}</Stat>
            <Stat label="Owner">{row.owner}</Stat>
            <Stat label="Weakness">{row.cwe}</Stat>
            <Stat label="First seen">
              {row.firstSeen} by {row.scanner}
            </Stat>
          </dl>
          <h4 className="mt-4 text-sm font-semibold">Scanner output</h4>
          {injection.suspicious && (
            <p role="note" className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
              <strong>Possible prompt injection</strong> ({injection.signals.join(', ')}). Shown as
              plain text and passed to the analyst only as untrusted data. This check is a heuristic
              warning, not a guarantee.
            </p>
          )}
          {/* Untrusted text: rendered as a text node, never as HTML or markdown. */}
          <pre
            data-testid="scanner-output"
            className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap"
          >
            {row.scannerText}
          </pre>
        </section>

        <section aria-labelledby="activity-heading">
          <h3 id="activity-heading" className="text-base font-semibold">
            Activity
          </h3>
          {history.length ? (
            <ol className="mt-2 flex flex-col gap-2 text-sm">
              {history.map((entry, i) => (
                <li key={i} className="border-l-2 border-line pl-3">
                  <span className="text-xs text-muted">
                    {new Date(entry.at).toLocaleString()} · {entry.actor}
                  </span>
                  <p>{entry.summary}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">No actions yet.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
