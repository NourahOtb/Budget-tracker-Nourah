import {
  budgetStatus,
  byNewest,
  inPeriod,
  paceGap,
  perDay,
  periodFor,
  spentByCat,
  sumFils,
  type BudgetStatus,
  type Period,
} from "./budget";
import { addDays, type DateKey } from "./dates";
import type { Settings, Spending } from "./types";

export type Summary = {
  today: DateKey;
  period: Period;
  /** This period's spendings, newest first. */
  current: Spending[];
  total: number;
  spent: number;
  left: number;
  status: BudgetStatus;
  gap: number;
  perDay: number;
  catSpent: Record<string, number>;
  prevPeriod: Period;
  /** Spent in the previous period up to the same day, or null when there's nothing to compare. */
  prevSoFar: number | null;
};

export function summarize(settings: Settings, spendings: Spending[], today: DateKey): Summary {
  const period = periodFor(today, settings.payday);
  const current = spendings.filter((t) => inPeriod(t.date, period)).sort(byNewest);
  const spent = sumFils(current);
  const left = settings.total - spent;
  const prevPeriod = periodFor(addDays(period.start, -1), settings.payday);
  const prevAll = spendings.filter((t) => inPeriod(t.date, prevPeriod));
  const sameDay = addDays(prevPeriod.start, Math.min(period.dayIndex, prevPeriod.days - 1));
  const prevSoFar = prevAll.length ? sumFils(prevAll.filter((t) => t.date <= sameDay)) : null;
  return {
    today,
    period,
    current,
    total: settings.total,
    spent,
    left,
    status: budgetStatus(settings.total, spent, period.elapsedPct),
    gap: paceGap(settings.total, spent, period.elapsedPct),
    perDay: perDay(left, period.daysLeft),
    catSpent: spentByCat(current, settings.categories.map((c) => c.id)),
    prevPeriod,
    prevSoFar,
  };
}

export type Usual = { name: string; fils: number; cat: string };

/** The person's most frequent spendings (by name), with their latest amount. */
export function usuals(spendings: Spending[], limit = 3): Usual[] {
  const groups = new Map<string, { count: number; latest: Spending }>();
  for (const t of [...spendings].sort(byNewest)) {
    const key = t.name.trim().toLowerCase();
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { count: 1, latest: t });
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || byNewest(a.latest, b.latest))
    .slice(0, limit)
    .map((g) => ({ name: g.latest.name, fils: g.latest.fils, cat: g.latest.cat }));
}
