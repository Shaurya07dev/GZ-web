// Fuse.js wrapper. Matches a user's typed query against the FAQ knowledge
// base, weighting the canonical question highest, then aliases, then tags.
// Returns the best entry if the match score is confident enough, else null
// (caller falls back to a "I don't have an answer" message).

import Fuse from "fuse.js";
import { FAQ_KNOWLEDGE_BASE, type FaqEntry } from "./faq-knowledge-base";

// Fuse score is 0 (perfect) → 1 (no match). Below this threshold we trust
// the match; above it we return null. 0.4 is Fuse's sensible default for
// typed-question matching; lower is stricter.
const MATCH_THRESHOLD = 0.42;

const fuse = new Fuse(FAQ_KNOWLEDGE_BASE, {
  // Lower threshold here = Fuse's own cutoff for including a result at all;
  // we re-check the returned score against MATCH_THRESHOLD above for the
  // final yes/no.
  threshold: 0.5,
  includeScore: true,
  ignoreLocation: true,
  // Weights sum to 1. The canonical question gets the lion's share — a
  // match on an alias is also strong, a tag match is a weaker signal.
  keys: [
    { name: "question", weight: 0.55 },
    { name: "aliases", weight: 0.3 },
    { name: "tags", weight: 0.15 },
  ],
});

export interface FuzzyMatchResult {
  entry: FaqEntry;
  /** 0 (perfect) → 1 (no match). Caller uses this to decide confidence copy. */
  score: number;
}

export function findBestFaqMatch(query: string): FuzzyMatchResult | null {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  const results = fuse.search(trimmed, { limit: 1 });
  const top = results[0];
  if (!top || typeof top.score !== "number") return null;
  if (top.score > MATCH_THRESHOLD) return null;
  return { entry: top.item, score: top.score };
}

/**
 * Suggested starter questions shown when the assistant panel first opens.
 * Picks the first N entries tagged `everyone` so the suggestions are useful
 * regardless of the user's role.
 */
export function getStarterQuestions(count = 4): FaqEntry[] {
  const everyone = FAQ_KNOWLEDGE_BASE.filter((e) => e.audience === "everyone");
  return everyone.slice(0, count);
}
