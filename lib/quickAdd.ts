import { CAT_KEYS, KEYWORDS, type CatKey } from "./categories";
import { parseKwd } from "./money";

export type Draft = { fils: number; name: string; cat: CatKey };

// Longer keywords match anywhere ("groceries", "takeaway coffee"). Short ones must
// start or end a word, so "handbag" finds "bag" but "vacation" doesn't find "cat".
function matches(lower: string, w: string): boolean {
  return w.length > 3 ? lower.includes(w) : new RegExp(`\\b${w}|${w}\\b`).test(lower);
}

/** Guesses a category from words like "coffee" or "taxi". Falls back to Fun. */
export function guessCategory(text: string): CatKey {
  const lower = text.toLowerCase();
  for (const k of CAT_KEYS) {
    if (KEYWORDS[k].some((w) => matches(lower, w))) return k;
  }
  return "fun";
}

/** "4.5 coffee" -> 4500 fils, "Coffee", Food. Returns null without a positive amount. */
export function parseQuickAdd(text: string): Draft | null {
  const m = text.match(/\d+(?:[.,]\d{1,3})?/);
  if (!m) return null;
  const fils = parseKwd(m[0]);
  if (!fils) return null;
  const words = text
    .replace(m[0], " ")
    .replace(/\b(kwd|kd)\b/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
  const name = words ? words[0].toUpperCase() + words.slice(1) : "Something";
  return { fils, name, cat: guessCategory(words) };
}
