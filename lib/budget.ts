import { CAT_KEYS, type CatKey } from "./categories";
import { addDays, daysInMonth, diffDays, makeKey, parts, type DateKey } from "./dates";
import type { Spending } from "./types";

export type Period = {
  start: DateKey;
  /** Last day of the period, inclusive. */
  end: DateKey;
  /** Length of the period in days. */
  days: number;
  /** 0 on the first day. */
  dayIndex: number;
  /** Days left including today. */
  daysLeft: number;
  /** How far through the period today is, 0 to 100, counting today as passed. */
  elapsedPct: number;
};

function paydayIn(y: number, m: number, payday: number): DateKey {
  return makeKey(y, m, Math.min(payday, daysInMonth(y, m)));
}

/** The budget period that contains `today`, given the day of the month money arrives. */
export function periodFor(today: DateKey, payday: number): Period {
  const { y, m } = parts(today);
  let start = paydayIn(y, m, payday);
  if (diffDays(start, today) < 0) {
    const prev = new Date(Date.UTC(y, m - 1, 1));
    start = paydayIn(prev.getUTCFullYear(), prev.getUTCMonth(), payday);
  }
  const s = parts(start);
  const nextMonth = new Date(Date.UTC(s.y, s.m + 1, 1));
  const next = paydayIn(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), payday);
  const days = diffDays(start, next);
  const dayIndex = diffDays(start, today);
  return {
    start,
    end: addDays(next, -1),
    days,
    dayIndex,
    daysLeft: days - dayIndex,
    elapsedPct: ((dayIndex + 1) / days) * 100,
  };
}

export function inPeriod(date: DateKey, p: Pick<Period, "start" | "end">): boolean {
  return date >= p.start && date <= p.end;
}

export type BudgetStatus = "track" | "close" | "over";

/**
 * Over when the amount left is below zero; getting close when the share spent
 * is more than 12 points ahead of the share of the period gone; on track otherwise.
 */
export function budgetStatus(totalFils: number, spentFils: number, elapsedPct: number): BudgetStatus {
  if (totalFils - spentFils < 0) return "over";
  const spentPct = totalFils > 0 ? (spentFils / totalFils) * 100 : 0;
  return spentPct - elapsedPct > 12 ? "close" : "track";
}

/** Points the spending is ahead of the period's pace (positive means faster). */
export function paceGap(totalFils: number, spentFils: number, elapsedPct: number): number {
  const spentPct = totalFils > 0 ? (spentFils / totalFils) * 100 : 0;
  return spentPct - elapsedPct;
}

export type CategoryState = {
  kind: "ok" | "close" | "over";
  /** Share of the limit spent, 0 to infinity. */
  pct: number;
  /** Limit minus spent; negative when over. */
  left: number;
};

/** "Close" at 75% of the limit or more, "over" above the limit. */
export function categoryState(spentFils: number, limitFils: number): CategoryState {
  const left = limitFils - spentFils;
  if (spentFils > limitFils) return { kind: "over", pct: limitFils > 0 ? (spentFils / limitFils) * 100 : 100, left };
  const pct = limitFils > 0 ? (spentFils / limitFils) * 100 : 0;
  return { kind: pct >= 75 ? "close" : "ok", pct, left };
}

/** What can be spent each remaining day (today included), in whole fils. */
export function perDay(leftFils: number, daysLeft: number): number {
  if (leftFils <= 0 || daysLeft <= 0) return 0;
  return Math.round(leftFils / daysLeft);
}

export function sumFils(list: Spending[]): number {
  return list.reduce((a, t) => a + t.fils, 0);
}

export function spentByCat(list: Spending[]): Record<CatKey, number> {
  const out = Object.fromEntries(CAT_KEYS.map((k) => [k, 0])) as Record<CatKey, number>;
  for (const t of list) out[t.cat] += t.fils;
  return out;
}

/** Newest first: by date, then by when it was entered. */
export function byNewest(a: Spending, b: Spending): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return b.createdAt - a.createdAt;
}

export type Mood = "content" | "curious" | "needy" | "playful" | "worried";

export function moodFor(o: { status: BudgetStatus; pulse: boolean; gap: number; hasQuestion: boolean }): Mood {
  if (o.pulse && o.status !== "over") return "playful";
  if (o.status === "over") return "worried";
  if (o.status === "close") return "needy";
  if (o.gap > 5 && o.hasQuestion) return "curious";
  return "content";
}
