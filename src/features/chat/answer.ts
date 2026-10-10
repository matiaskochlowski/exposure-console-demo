import { CONCEPTS, matchConcept, type ConceptId } from '../concepts/concepts.js';

export interface LocalAnswer {
  text: string;
  conceptId?: ConceptId;
}

/**
 * Answers concept questions from the built-in glossary. Deliberately local: no model call, so
 * nothing typed here leaves the browser. Finding-specific questions belong to the finding's analyst.
 */
export function answerLocally(question: string): LocalAnswer {
  const concept = matchConcept(question);
  if (concept) return { text: `${concept.term}: ${concept.long}`, conceptId: concept.id };
  const topics = CONCEPTS.map((c) => c.term).join(', ');
  return {
    text: `I can explain the concepts used in this console: ${topics}. For questions about a specific finding, open it from Exposures and ask its AI analyst, which sees that finding's details.`,
  };
}
