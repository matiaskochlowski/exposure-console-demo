/**
 * Data-classification redaction applied before anything is sent to a model provider.
 * Runs on the server for live requests (authoritative) and in the browser only to show the same
 * payload in mock mode. See docs/security-ai.md.
 */
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const TLDS =
  'com|net|org|io|dev|cloud|app|ai|co|us|uk|de|gov|edu|mil|int|biz|info|local|internal|corp|lan|home|arpa';

const PATTERNS = [
  ['EMAIL', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  // IPv6 before IPv4 so embedded forms (::ffff:10.0.0.1) are consumed whole. Over-matching times
  // like 10:30:00 is accepted: redaction errs towards withholding.
  ['IP', /(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9a-f]{1,4})(?![\w:])/gi],
  ['IP', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  // Known TLDs at any depth, plus any 3+-label name ending in a 2-letter country code.
  [
    'HOST',
    new RegExp(`\\b(?:${LABEL}\\.)+(?:${TLDS})\\b\\.?|\\b(?:${LABEL}\\.){2,}[a-z]{2}\\b\\.?`, 'gi'),
  ],
] as const;

export interface Redaction {
  text: string;
  /** Count per category, shown in the "what will be sent" panel. Original values never leave. */
  counts: Record<string, number>;
}

export function redact(input: string): Redaction {
  const counts: Record<string, number> = {};
  const seen = new Map<string, string>();
  let text = input;
  for (const [label, pattern] of PATTERNS) {
    text = text.replace(pattern, (match) => {
      const existing = seen.get(match);
      if (existing) return existing;
      counts[label] = (counts[label] ?? 0) + 1;
      const token = `[${label}_${counts[label]}]`;
      seen.set(match, token);
      return token;
    });
  }
  return { text, counts };
}
