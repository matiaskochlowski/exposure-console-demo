/**
 * Heuristic prompt-injection detector for untrusted scanner text.
 *
 * This is a WARNING signal for the UI, not a security boundary: it will miss novel phrasings and
 * can flag benign text. The real defences are structural (ADR 0003): untrusted text is delimited
 * as data, the model can only propose a fixed set of validated actions, and a human approves each.
 */
const SIGNALS: Array<[string, RegExp]> = [
  [
    'override-instructions',
    /\b(ignore|disregard|forget)\b[^.]{0,40}\b(previous|prior|above|earlier|your)\b[^.]{0,20}\b(instructions?|rules|guidance|prompt)/i,
  ],
  ['role-hijack', /\b(system override|you are now|act as|developer mode|admin mode)\b/i],
  [
    'delimiter-escape',
    /<\/?\s*(untrusted_scanner_output|finding_context|system|assistant|instructions?)\s*>/i,
  ],
  [
    'tool-coercion',
    /\b(call|invoke|run|execute)\s+(accept_risk|set_priority|open_ticket)\b|\bapprove every\b/i,
  ],
  [
    'addressing-the-model',
    /\b(assistant|ai|model|llm)\s*,\s*(please\s+)?(disregard|ignore|reply|respond|forget)\b/i,
  ],
  ['script-or-unsafe-url', /<\s*(script|img|iframe)\b|javascript:|data:text\/html/i],
];

export interface InjectionVerdict {
  suspicious: boolean;
  signals: string[];
}

export function detectInjection(text: string): InjectionVerdict {
  const signals = SIGNALS.filter(([, re]) => re.test(text)).map(([name]) => name);
  return { suspicious: signals.length > 0, signals };
}
