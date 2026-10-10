import { createContext, useContext } from 'react';

/** Where an "Ask about this" button sends its question. */
export interface AskTarget {
  /** Button text, e.g. "Ask the assistant" or "Ask the analyst". */
  label: string;
  ask: (question: string) => void;
}

/**
 * The app-level value opens the concepts chat; the finding drawer overrides it so questions asked
 * there go to that finding's AI analyst instead.
 */
export const AskContext = createContext<AskTarget | null>(null);

export function useAsk(): AskTarget | null {
  return useContext(AskContext);
}
