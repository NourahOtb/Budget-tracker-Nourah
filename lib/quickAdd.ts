import { PRESET, type Category } from "./categories";
import { parseKwd } from "./money";

export type Draft = { fils: number; name: string; cat: string };

// Longer keywords match anywhere ("groceries", "takeaway coffee"). Short ones must
// start or end a word, so "handbag" finds "bag" but "vacation" doesn't find "cat".
function matches(lower: string, w: string): boolean {
  return w.length > 3 ? lower.includes(w) : new RegExp(`\\b${w}|${w}\\b`).test(lower);
}

/**
 * Guesses which of the owner's categories a spending belongs to: a category
 * named in the text first ("gym membership" -> Gym), then the presets' keywords.
 * Falls back to Fun if she has it, otherwise her first category.
 */
export function guessCategory(text: string, categories: Category[]): string {
  if (!categories.length) return "";
  const lower = text.toLowerCase();
  const named = categories.find((c) => {
    const n = c.name.toLowerCase();
    return n.length > 1 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(lower);
  });
  if (named) return named.id;
  const byKeyword = categories.find((c) => PRESET[c.id]?.keywords.some((w) => matches(lower, w)));
  if (byKeyword) return byKeyword.id;
  return categories.find((c) => c.id === "fun")?.id ?? categories[0].id;
}

/** "4.5 coffee" -> 4500 fils, "Coffee", Food. Returns null without a positive amount. */
export function parseQuickAdd(text: string, categories: Category[]): Draft | null {
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
  return { fils, name, cat: guessCategory(words, categories) };
}
