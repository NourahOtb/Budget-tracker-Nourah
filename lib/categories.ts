// Categories are the owner's own data: she picks from the presets below or types
// her own, and can rename, add or delete them later. Colours alone don't
// separate well for colour-blind readers, so the icon or name is always shown
// beside the colour.

export type Category = {
  /** A preset's key ("food"), or a generated id for one the owner typed. */
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Monthly limit in fils. */
  limit: number;
};

export type Preset = Omit<Category, "limit"> & {
  /** Share of a 500 KWD budget in the design; used to suggest starting limits. */
  starterFils: number;
  /** Words in a spending's name that suggest this category. */
  keywords: string[];
};

export const PRESETS: Preset[] = [
  {
    id: "food",
    name: "Food",
    color: "#EE7F3B",
    starterFils: 110_000,
    icon: "M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 9h2a2 2 0 0 1 0 5h-2M8 2v3M12 2v3",
    keywords: ["coffee", "latte", "tea", "karak", "lunch", "dinner", "breakfast", "shawarma", "burger", "sushi", "pizza", "delivery", "grocer", "restaurant", "cafe", "snack", "food"],
  },
  {
    id: "transport",
    name: "Transport",
    color: "#3D97EC",
    starterFils: 50_000,
    icon: "M5 11l2-5h10l2 5M4 11h16v6H4zM7 17v2M17 17v2M7.5 14h.01M16.5 14h.01",
    keywords: ["taxi", "uber", "careem", "fuel", "petrol", "parking", "bus", "car"],
  },
  {
    id: "fun",
    name: "Fun",
    color: "#9B6CF5",
    starterFils: 70_000,
    icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    keywords: ["cinema", "movie", "game", "concert", "gift", "netflix", "spotify", "trip"],
  },
  {
    id: "shopping",
    name: "Shopping",
    color: "#C9A227",
    starterFils: 55_000,
    icon: "M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2",
    keywords: ["shoes", "bag", "dress", "clothes", "makeup", "beads", "shirt", "perfume", "tv", "laptop", "headphone", "electronics"],
  },
  {
    id: "papi",
    name: "Papi",
    color: "#E8628F",
    starterFils: 25_000,
    icon: "M12 13c-3 0-5 2.2-5 4.5 0 1.5 1.2 2.5 2.7 2.5.9 0 1.5-.4 2.3-.4s1.4.4 2.3.4c1.5 0 2.7-1 2.7-2.5 0-2.3-2-4.5-5-4.5zM4.5 9.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM8.5 5.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM12.5 5.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM16.5 9.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0z",
    keywords: ["papi", "cat", "litter", "treat", "vet", "kibble", "toy"],
  },
  {
    id: "bills",
    name: "Bills",
    color: "#28AB9E",
    starterFils: 190_000,
    icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
    keywords: ["rent", "phone", "internet", "gym", "electric", "water", "insurance"],
  },
];

export const PRESET: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

/** Icon for categories the owner types herself. */
export const TAG_ICON = "M3 12V4h8l10 10-8 8zM7.5 8.5h.01";

// Colours for typed categories, picked in order, skipping any already in use.
// All are light enough for the dark icon drawn on top of them.
const CUSTOM_COLORS = ["#D9705B", "#5BB0A8", "#B98AE0", "#8FB04A", "#E09A56", "#6E9BE6", "#D96FA6", "#49B07E", "#C9B458", "#A08CCF"];

/** Shown for a spending whose category no longer exists (shouldn't happen, but never crash). */
export const UNKNOWN_CATEGORY: Category = { id: "", name: "Other", color: "#A99EB5", icon: TAG_ICON, limit: 0 };

export function presetCategory(p: Preset, limit = 0): Category {
  return { id: p.id, name: p.name, color: p.color, icon: p.icon, limit };
}

/** A new category from a name the owner typed. */
export function customCategory(id: string, name: string, existing: Category[]): Category {
  const used = new Set(existing.map((c) => c.color.toUpperCase()));
  const color = CUSTOM_COLORS.find((c) => !used.has(c)) ?? CUSTOM_COLORS[existing.length % CUSTOM_COLORS.length];
  return { id, name, color, icon: TAG_ICON, limit: 0 };
}

export function byId(categories: Category[]): Record<string, Category> {
  return Object.fromEntries(categories.map((c) => [c.id, c]));
}

/** Tidies a typed category name: trimmed, single spaces, capitalised. */
export function cleanName(text: string): string {
  const t = text.trim().replace(/\s+/g, " ").slice(0, 30);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/**
 * Suggested limits for a monthly total, spread by the presets' design shares
 * (typed categories weigh like a mid-sized preset), rounded down to 5 KWD.
 * The biggest category takes the remainder so the suggestion adds up exactly.
 */
export function suggestLimits(totalFils: number, categories: Category[]): Category[] {
  if (!categories.length) return [];
  const weight = (c: Category) => PRESET[c.id]?.starterFils ?? 50_000;
  const sum = categories.reduce((a, c) => a + weight(c), 0);
  const biggest = categories.reduce((a, c) => (weight(c) > weight(a) ? c : a), categories[0]);
  let assigned = 0;
  const out = categories.map((c) => {
    if (c === biggest) return c;
    const limit = Math.floor((totalFils * weight(c)) / sum / 5000) * 5000;
    assigned += limit;
    return { ...c, limit };
  });
  return out.map((c) => (c === biggest ? { ...c, limit: Math.max(0, totalFils - assigned) } : c));
}
