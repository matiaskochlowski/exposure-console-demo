import { PRIORITY_THRESHOLDS, RISK_WEIGHTS } from '../../shared/risk.js';

/**
 * Plain-language explanations shown in tooltips, "What does this mean?" popovers, the Glossary page
 * and the concepts chat. Static, trusted text: rendered as text, never as HTML or markdown.
 */
export interface Concept {
  id: ConceptId;
  term: string;
  /** One line, for tooltips. */
  short: string;
  /** A few sentences, for popovers, the glossary and chat answers. */
  long: string;
  /** Lower-case words that make the chat pick this concept. */
  aliases: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const thresholds = PRIORITY_THRESHOLDS.map(([p, min]) => `${p} ≥ ${min}`).join(', ');

const CONCEPTS_LIST = [
  {
    id: 'exposure',
    term: 'Exposure',
    short: 'A weakness an attacker could actually reach: a vulnerability on a specific asset.',
    long: 'An exposure is a vulnerability in context: which asset it is on, whether that asset is reachable and important, and whether attackers are exploiting it. Exposure management ranks these by real-world risk instead of raw severity, so the team fixes what attackers will use first.',
    aliases: ['exposure', 'exposures', 'finding', 'findings', 'vulnerability'],
  },
  {
    id: 'risk',
    term: 'Risk score',
    short:
      'A 0–1 score combining severity, exploit likelihood, exploitation evidence and asset importance.',
    long: `The risk score blends five signals: CVSS severity (${pct(RISK_WEIGHTS.cvss)}), EPSS exploit probability (${pct(RISK_WEIGHTS.epss)}), known exploitation (KEV, ${pct(RISK_WEIGHTS.kev)}), a validated exploit on this asset (${pct(RISK_WEIGHTS.exploitValidated)}) and asset criticality (${pct(RISK_WEIGHTS.assetCriticality)}). Exploitation evidence is weighted so that an actively exploited medium-severity bug outranks an unexploited critical one.`,
    aliases: ['risk', 'risk score', 'score', 'ranking', 'ranked', 'sorted'],
  },
  {
    id: 'priority',
    term: 'Priority (P1–P4)',
    short: 'Fix order derived from the risk score. P1 means fix first.',
    long: `Priority buckets the risk score into fix order: ${thresholds}, everything else is P4. A person can override a priority with a reason through an approved action; overridden priorities are marked with an asterisk.`,
    aliases: ['priority', 'p1', 'p2', 'p3', 'p4', 'prioritised', 'prioritized', 'why p1'],
  },
  {
    id: 'cvss',
    term: 'CVSS',
    short: 'Technical severity from 0 to 10, without context about your environment.',
    long: 'The Common Vulnerability Scoring System rates how bad a vulnerability is in theory, from 0 to 10. It does not know whether anyone is exploiting it or how important the affected asset is, which is why it is only one input to the risk score.',
    aliases: ['cvss', 'severity', 'critical', 'base score'],
  },
  {
    id: 'epss',
    term: 'EPSS',
    short: 'Probability that this vulnerability is exploited in the wild in the next 30 days.',
    long: 'The Exploit Prediction Scoring System estimates the chance (0–100%) that a vulnerability will be exploited in the wild within 30 days, based on observed attacker activity. A high EPSS with a modest CVSS is often more urgent than the reverse.',
    aliases: ['epss', 'probability', 'likelihood', 'exploit prediction'],
  },
  {
    id: 'kev',
    term: 'Known exploited (KEV)',
    short: 'Listed in a catalog of vulnerabilities that attackers have exploited in the wild.',
    long: 'KEV stands for Known Exploited Vulnerability: the vulnerability appears in a catalog of ones that attackers have already used in real attacks. KEV status is strong evidence that the risk is not theoretical. In the queue it shows as the "KEV" chip.',
    aliases: ['kev', 'known exploited', 'exploited', 'in the wild', 'catalog'],
  },
  {
    id: 'validated',
    term: 'Exploit validated',
    short: 'A safe attack simulation proved this weakness exploitable on this asset.',
    long: 'An exploit is validated when a controlled, safe attack simulation actually succeeded against this specific asset. It turns "could be exploited" into "is exploitable here", which is why it carries as much weight as KEV. In the queue it shows as the "Ex" chip.',
    aliases: ['validated', 'validation', 'exploit validated', 'ex', 'proven', 'simulation'],
  },
  {
    id: 'criticality',
    term: 'Asset criticality',
    short: 'Business importance of the affected asset, from 1 (low) to 4 (crown jewel).',
    long: 'Asset criticality rates how much the business depends on the affected system, from 1 to 4. The same vulnerability matters more on a production payment service than on a test box.',
    aliases: ['criticality', 'asset criticality', 'crown jewel', 'asset', 'business impact'],
  },
  {
    id: 'cwe',
    term: 'CWE (weakness class)',
    short: 'The category of mistake behind the vulnerability, e.g. CWE-79 cross-site scripting.',
    long: 'A Common Weakness Enumeration id names the class of flaw, such as CWE-79 (cross-site scripting) or CWE-502 (unsafe deserialisation). Grouping by CWE shows which kinds of mistakes keep recurring, which is where training or tooling pays off.',
    aliases: ['cwe', 'weakness', 'weakness class', 'category'],
  },
  {
    id: 'status',
    term: 'Status',
    short: 'Where a finding is in its lifecycle: Open, In progress, Risk accepted or Resolved.',
    long: 'Open means nobody is working on it yet. In progress means a fix is under way (for example, a ticket was opened). Risk accepted means someone decided, with a reason and an expiry date, not to fix it for now. Resolved means it is fixed.',
    aliases: ['status', 'open', 'in progress', 'resolved', 'lifecycle'],
  },
  {
    id: 'risk_accepted',
    term: 'Risk accepted',
    short: 'A deliberate, time-limited decision not to fix a finding yet, with a recorded reason.',
    long: 'Accepting risk is a documented decision to live with a finding for a limited time, for example because a compensating control exists. It always has a reason and an expiry date, after which the finding needs another look.',
    aliases: ['risk accepted', 'accept', 'acceptance', 'exception'],
  },
  {
    id: 'analyst',
    term: 'AI analyst',
    short: 'Explains a finding and proposes actions. It never acts until a person approves.',
    long: "The AI analyst reads one finding's redacted, allowlisted details and explains the risk or proposes an action, such as opening a ticket or changing priority. Every proposal waits for a person to review, edit and approve it. Hostnames, IPs and owners never leave the browser.",
    aliases: ['analyst', 'ai', 'assistant', 'model', 'proposal', 'approve', 'approval'],
  },
] as const satisfies ReadonlyArray<Omit<Concept, 'id'> & { id: string }>;

export type ConceptId = (typeof CONCEPTS_LIST)[number]['id'];

export const CONCEPTS: readonly Concept[] = CONCEPTS_LIST.map((c) => ({
  ...c,
  aliases: [...c.aliases],
}));

export const CONCEPT_BY_ID = Object.fromEntries(CONCEPTS.map((c) => [c.id, c])) as Record<
  ConceptId,
  Concept
>;

/**
 * Best concept for a free-text question, or undefined. Longest matching alias wins, so
 * "risk accepted" beats "risk". Word-boundary matching keeps "ex" from matching "explain".
 */
export function matchConcept(question: string): Concept | undefined {
  const q = question.toLowerCase();
  let best: { concept: Concept; length: number } | undefined;
  for (const concept of CONCEPTS) {
    for (const alias of concept.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(q) && alias.length > (best?.length ?? 0))
        best = { concept, length: alias.length };
    }
  }
  return best?.concept;
}
