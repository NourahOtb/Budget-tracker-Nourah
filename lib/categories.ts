export type CatKey = "food" | "transport" | "fun" | "shopping" | "papi" | "bills";

export type Category = {
  key: CatKey;
  name: string;
  color: string;
  /** Share of a 500 KWD budget in the design; used to suggest starting limits. */
  starterFils: number;
  icon: string;
};

// Fixed order. Colours alone don't separate well for colour-blind readers, so the
// icon or name is always shown beside the colour.
export const CATEGORIES: Category[] = [
  { key: "food", name: "Food", color: "#EE7F3B", starterFils: 110_000, icon: "M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 9h2a2 2 0 0 1 0 5h-2M8 2v3M12 2v3" },
  { key: "transport", name: "Transport", color: "#3D97EC", starterFils: 50_000, icon: "M5 11l2-5h10l2 5M4 11h16v6H4zM7 17v2M17 17v2M7.5 14h.01M16.5 14h.01" },
  { key: "fun", name: "Fun", color: "#9B6CF5", starterFils: 70_000, icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
  { key: "shopping", name: "Shopping", color: "#C9A227", starterFils: 55_000, icon: "M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2" },
  { key: "papi", name: "Papi", color: "#E8628F", starterFils: 25_000, icon: "M12 13c-3 0-5 2.2-5 4.5 0 1.5 1.2 2.5 2.7 2.5.9 0 1.5-.4 2.3-.4s1.4.4 2.3.4c1.5 0 2.7-1 2.7-2.5 0-2.3-2-4.5-5-4.5zM4.5 9.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM8.5 5.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM12.5 5.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM16.5 9.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0z" },
  { key: "bills", name: "Bills", color: "#28AB9E", starterFils: 190_000, icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
];

export const CAT_KEYS: CatKey[] = CATEGORIES.map((c) => c.key);

export const CAT: Record<CatKey, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CatKey, Category>;

export const STARTER_TOTAL = CATEGORIES.reduce((a, c) => a + c.starterFils, 0);

export const KEYWORDS: Record<CatKey, string[]> = {
  food: ["coffee", "latte", "tea", "karak", "lunch", "dinner", "breakfast", "shawarma", "burger", "sushi", "pizza", "delivery", "grocer", "restaurant", "cafe", "snack", "food"],
  transport: ["taxi", "uber", "careem", "fuel", "petrol", "parking", "bus", "car"],
  fun: ["cinema", "movie", "game", "concert", "gift", "netflix", "spotify", "trip"],
  shopping: ["shoes", "bag", "dress", "clothes", "makeup", "beads", "shirt", "perfume"],
  papi: ["papi", "cat", "litter", "treat", "vet", "kibble", "toy"],
  bills: ["rent", "phone", "internet", "gym", "electric", "water", "insurance"],
};

/** Suggested category limits for a monthly total, in the design's proportions, rounded to 5 KWD. */
export function suggestLimits(totalFils: number): Record<CatKey, number> {
  const out = {} as Record<CatKey, number>;
  let assigned = 0;
  for (const c of CATEGORIES) {
    if (c.key === "bills") continue;
    const v = Math.floor((totalFils * c.starterFils) / STARTER_TOTAL / 5000) * 5000;
    out[c.key] = v;
    assigned += v;
  }
  // Bills takes the remainder so the suggestion adds up exactly.
  out.bills = Math.max(0, totalFils - assigned);
  return out;
}
