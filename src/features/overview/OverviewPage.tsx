import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { use, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { loadDataset } from '../../data/findings.js';
import { useRows } from '../../data/useRows.js';
import { RISK_WEIGHTS } from '../../shared/risk.js';
import { Card, CardHeader, EvidenceChip, PriorityBadge } from '../../ui/index.js';
import { ConceptHint } from '../concepts/ConceptHint.js';
import type { ConceptId } from '../concepts/concepts.js';
import { BarList, WeeklyColumns } from './charts.js';
import { overviewStats, percentChange, WEEKS } from './stats.js';

const ACTIVE = 'status=open%2Cin_progress';

function StatCard({
  label,
  concept,
  value,
  delta,
  headline,
  detail,
  to,
}: {
  label: string;
  concept: ConceptId;
  value: number;
  delta?: ReactNode;
  headline: string;
  detail: string;
  to: string;
}) {
  return (
    <div className="relative flex flex-col rounded-xl border border-line bg-gradient-to-b from-surface-2 to-surface p-5 shadow-sm transition-colors hover:border-accent has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="text-sm text-muted">{label}</h2>
          <span className="relative z-10">
            <ConceptHint id={concept} />
          </span>
        </div>
        {delta}
      </div>
      {/* Proportional figures for a standalone number (no tabular-nums). */}
      <p className="mt-1 text-3xl font-bold">{value.toLocaleString()}</p>
      <p className="mt-4 text-sm font-semibold">{headline}</p>
      <p className="text-sm text-muted">{detail}</p>
      {/* Stretched link: the whole card is the click target; the text is for assistive tech only. */}
      <Link to={to} className="after:absolute after:inset-0">
        <span className="sr-only">View in queue: {label}</span>
      </Link>
    </div>
  );
}

/** Up is bad for new exposures, so an increase reads as a warning, with an icon and sign, not colour alone. */
function Delta({ change }: { change: number }) {
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs font-bold ${up ? 'text-danger' : 'text-ok'}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {up ? '+' : ''}
      {change}%<span className="sr-only"> versus the previous 30 days</span>
    </span>
  );
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

const WEIGHTS: Array<{ id: ConceptId; label: string; weight: number }> = [
  { id: 'cvss', label: 'Severity (CVSS)', weight: RISK_WEIGHTS.cvss },
  { id: 'epss', label: 'Exploit likelihood (EPSS)', weight: RISK_WEIGHTS.epss },
  { id: 'kev', label: 'Known exploited (KEV)', weight: RISK_WEIGHTS.kev },
  { id: 'validated', label: 'Exploit validated', weight: RISK_WEIGHTS.exploitValidated },
  { id: 'criticality', label: 'Asset criticality', weight: RISK_WEIGHTS.assetCriticality },
];

const PRIORITY_MEANING = { P1: 'Fix first', P2: 'Fix soon', P3: 'Plan a fix', P4: 'Monitor' };

export default function OverviewPage() {
  const dataset = use(loadDataset());
  const rows = useRows(dataset);
  const s = useMemo(() => overviewStats(rows), [rows]);
  const change = percentChange(s.newLast30, s.newPrev30);
  // Weeks start on Monday; unless the data ends on a Sunday, the last week is incomplete.
  const partialWeek = new Date(`${s.asOf}T00:00:00Z`).getUTCDay() !== 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted">
            Where your exposure stands as of {s.asOf}: what is open, what attackers are using, and
            what to fix first.
          </p>
        </div>
        <Link
          to="/exposures"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3.5 text-sm font-semibold text-cta-fg hover:opacity-90"
        >
          Open the exposure queue
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open exposures"
          concept="exposure"
          value={s.active}
          delta={change !== undefined && <Delta change={change} />}
          headline={`${s.newLast30.toLocaleString()} new in the last 30 days`}
          detail="Open or in progress; resolved and accepted are excluded."
          to={`/exposures?${ACTIVE}`}
        />
        <StatCard
          label="P1, fix first"
          concept="priority"
          value={s.p1Active}
          headline={`${pct(s.p1Active, s.active)}% of open exposures`}
          detail="Highest risk score: exploitable, likely and on important assets."
          to={`/exposures?priority=P1&${ACTIVE}`}
        />
        <StatCard
          label="Known exploited"
          concept="kev"
          value={s.kevActive}
          headline={`${pct(s.kevActive, s.active)}% are being used by attackers`}
          detail="Listed in a catalog of vulnerabilities exploited in the wild."
          to={`/exposures?kev=1&${ACTIVE}`}
        />
        <StatCard
          label="Exploit validated"
          concept="validated"
          value={s.validatedActive}
          headline={`${pct(s.validatedActive, s.active)}% proven exploitable here`}
          detail="A safe attack simulation succeeded against the asset."
          to={`/exposures?validated=1&${ACTIVE}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card labelledBy="weekly-heading" className="xl:col-span-2">
          <CardHeader
            id="weekly-heading"
            title="New exposures per week"
            description={`First seen by a scanner, last ${WEEKS} weeks.${partialWeek ? ' The faded last bar is the current week, still in progress.' : ''}`}
            hint={<ConceptHint id="exposure" />}
          />
          <div className="px-5 pt-5 pb-4">
            <WeeklyColumns
              data={s.weekly}
              label="New exposures per week"
              partialLast={partialWeek}
            />
          </div>
        </Card>
        <Card labelledBy="priority-heading" className="xl:self-start">
          <CardHeader
            id="priority-heading"
            title="Open exposures by priority"
            description="Priority is the fix order derived from the risk score."
            hint={<ConceptHint id="priority" />}
          />
          <div className="px-5 py-4">
            <BarList
              labelWidth="w-28"
              data={s.byPriority.map((p) => ({
                key: p.priority,
                value: p.count,
                label: (
                  <span className="flex items-center gap-2">
                    <PriorityBadge priority={p.priority} />
                    <span className="text-muted">{PRIORITY_MEANING[p.priority]}</span>
                  </span>
                ),
              }))}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card labelledBy="fix-heading" className="xl:col-span-2">
          <CardHeader
            id="fix-heading"
            title="Fix first"
            description="The five highest-risk open exposures. Open one to see why, and ask the AI analyst what to do."
            hint={<ConceptHint id="risk" />}
            action={
              <Link
                to="/exposures"
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
              >
                All exposures
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
          />
          <ol className="mt-2 divide-y divide-row-line">
            {s.fixFirst.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/exposures/findings/${r.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                >
                  <PriorityBadge priority={r.priority} overridden={r.priorityOverridden} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.title}</span>
                    <span className="block truncate font-mono text-xs text-muted">{r.id}</span>
                  </span>
                  <span className="hidden gap-1 sm:flex">
                    {r.kev && <EvidenceChip short="KEV" label="Known exploited" />}
                    {r.exploitValidated && <EvidenceChip short="Ex" label="Exploit validated" />}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    <span className="sr-only">Risk </span>
                    {r.riskScore.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <Card labelledBy="cwe-heading">
          <CardHeader
            id="cwe-heading"
            title="Most common weaknesses"
            description="Open exposures by weakness class. Recurring classes point to training or tooling gaps."
            hint={<ConceptHint id="cwe" />}
          />
          <div className="px-5 py-4">
            <BarList
              labelWidth="w-36"
              data={s.topWeaknesses.map((w) => ({
                key: w.cwe,
                value: w.count,
                label: (
                  <span title={`${w.cwe}: ${w.label}`}>
                    {w.label} <span className="text-xs text-muted">{w.cwe}</span>
                  </span>
                ),
              }))}
            />
          </div>
        </Card>
      </div>

      <Card labelledBy="score-heading">
        <CardHeader
          id="score-heading"
          title="How the risk score is built"
          description="Every finding gets a 0–1 score from five signals. Exploitation evidence (KEV, validated) is weighted so an actively exploited medium bug outranks an unexploited critical one."
          hint={<ConceptHint id="risk" />}
        />
        <div className="px-5 py-4">
          <BarList
            labelWidth="w-52"
            data={WEIGHTS.map((w) => ({
              key: w.id,
              value: Math.round(w.weight * 100),
              suffix: '%',
              label: w.label,
              hint: <ConceptHint id={w.id} />,
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
