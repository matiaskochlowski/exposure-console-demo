import type { Row } from '../../data/findings.js';

/**
 * CSV export with formula-injection protection: scanner-derived cells that start with = + - @ (or
 * tab/CR) would execute as formulas in spreadsheet apps, so they are prefixed with a quote.
 */
export function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text.trimStart())) text = `'${text}`;
  return /[",\n\r]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text;
}

const COLUMNS: Array<[string, (r: Row) => unknown]> = [
  ['id', (r) => r.id],
  ['title', (r) => r.title],
  ['priority', (r) => r.priority],
  ['risk_score', (r) => r.riskScore],
  ['cvss', (r) => r.cvss],
  ['epss', (r) => r.epss],
  ['kev', (r) => r.kev],
  ['exploit_validated', (r) => r.exploitValidated],
  ['status', (r) => r.effectiveStatus],
  ['ticket', (r) => r.ticketId],
  ['hostname', (r) => r.hostname],
  ['environment', (r) => r.environment],
  ['domain', (r) => r.domain],
  ['scanner_text', (r) => r.scannerText],
];

export function toCsv(rows: readonly Row[]): string {
  const header = COLUMNS.map(([name]) => name).join(',');
  const lines = rows.map((r) => COLUMNS.map(([, get]) => csvCell(get(r))).join(','));
  return [header, ...lines].join('\r\n');
}
