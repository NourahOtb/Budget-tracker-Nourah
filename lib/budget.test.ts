import { describe, expect, it } from "vitest";
import { budgetStatus, categoryState, moodFor, perDay, periodFor } from "./budget";
import { suggestLimits } from "./categories";
import { fmt, fmtKwd, parseKwd } from "./money";
import { parseQuickAdd } from "./quickAdd";
import { summarize, usuals } from "./summary";
import { findQuestion } from "./papi";
import type { Spending } from "./types";

describe("fils formatting", () => {
  it("always shows three decimals", () => {
    expect(fmt(289700)).toBe("289.700");
    expect(fmt(0)).toBe("0.000");
    expect(fmt(5)).toBe("0.005");
    expect(fmt(1005)).toBe("1.005");
    expect(fmtKwd(500000)).toBe("500.000 KWD");
  });
  it("drops the sign", () => {
    expect(fmt(-2500)).toBe("2.500");
  });
  it("parses typed amounts into whole fils without float errors", () => {
    expect(parseKwd("4.5")).toBe(4500);
    expect(parseKwd("1,750")).toBe(1750);
    expect(parseKwd("0.1")).toBe(100);
    expect(parseKwd("12")).toBe(12000);
    expect(parseKwd("1.0005")).toBeNull();
    expect(parseKwd("0")).toBeNull();
    expect(parseKwd("abc")).toBeNull();
  });
});

describe("budget period", () => {
  it("matches the design: 25 Oct to 24 Nov, day 10 of 31, 22 days left", () => {
    const p = periodFor("2026-11-03", 25);
    expect(p.start).toBe("2026-10-25");
    expect(p.end).toBe("2026-11-24");
    expect(p.days).toBe(31);
    expect(p.dayIndex).toBe(9);
    expect(p.daysLeft).toBe(22);
    expect(p.elapsedPct).toBeCloseTo(32.26, 1);
  });
  it("starts on payday itself", () => {
    const p = periodFor("2026-11-25", 25);
    expect(p.start).toBe("2026-11-25");
    expect(p.dayIndex).toBe(0);
  });
  it("uses the last day of short months", () => {
    const p = periodFor("2027-02-28", 31);
    expect(p.start).toBe("2027-02-28");
    expect(p.end).toBe("2027-03-30");
    const jan = periodFor("2027-02-10", 31);
    expect(jan.start).toBe("2027-01-31");
    expect(jan.end).toBe("2027-02-27");
  });
  it("crosses the year", () => {
    const p = periodFor("2027-01-03", 25);
    expect(p.start).toBe("2026-12-25");
    expect(p.end).toBe("2027-01-24");
  });
});

describe("budget status", () => {
  const elapsed = (10 / 31) * 100;
  it("is on track at the design's numbers", () => {
    expect(budgetStatus(500000, 210300, elapsed)).toBe("track");
  });
  it("is getting close when spending runs more than 12 points ahead", () => {
    expect(budgetStatus(500000, 270300, elapsed)).toBe("close");
    expect(budgetStatus(500000, 220000, elapsed)).toBe("track");
  });
  it("is over below zero", () => {
    expect(budgetStatus(500000, 510300, elapsed)).toBe("over");
    expect(budgetStatus(500000, 500000, 100)).toBe("track");
  });
});

describe("category state", () => {
  it("shows close at 75% or more", () => {
    expect(categoryState(22500, 25000).kind).toBe("close");
    expect(categoryState(18750, 25000).kind).toBe("close");
    expect(categoryState(18749, 25000).kind).toBe("ok");
  });
  it("shows over above the limit with the amount", () => {
    const s = categoryState(57500, 55000);
    expect(s.kind).toBe("over");
    expect(s.left).toBe(-2500);
    expect(categoryState(55000, 55000).kind).toBe("close");
  });
  it("handles a zero limit", () => {
    expect(categoryState(0, 0).kind).toBe("ok");
    expect(categoryState(1, 0).kind).toBe("over");
  });
});

describe("per-day amount", () => {
  it("splits what is left over the days left", () => {
    expect(perDay(289700, 22)).toBe(13168);
  });
  it("is zero when nothing is left", () => {
    expect(perDay(-5000, 22)).toBe(0);
    expect(perDay(1000, 0)).toBe(0);
  });
});

describe("mood", () => {
  it("follows the priority order", () => {
    expect(moodFor({ status: "track", pulse: true, gap: 0, hasQuestion: false })).toBe("playful");
    expect(moodFor({ status: "over", pulse: true, gap: 0, hasQuestion: false })).toBe("worried");
    expect(moodFor({ status: "close", pulse: false, gap: 20, hasQuestion: true })).toBe("needy");
    expect(moodFor({ status: "track", pulse: false, gap: 6, hasQuestion: true })).toBe("curious");
    expect(moodFor({ status: "track", pulse: false, gap: 6, hasQuestion: false })).toBe("content");
  });
});

describe("quick add", () => {
  it("reads amount, name and category", () => {
    expect(parseQuickAdd("4.5 coffee")).toEqual({ fils: 4500, name: "Coffee", cat: "food" });
    expect(parseQuickAdd("taxi home 2.5 kwd")).toEqual({ fils: 2500, name: "Taxi home", cat: "transport" });
    expect(parseQuickAdd("12 groceries")?.cat).toBe("food");
    expect(parseQuickAdd("300 handbag")?.cat).toBe("shopping");
    expect(parseQuickAdd("40 vacation")?.cat).toBe("fun");
    expect(parseQuickAdd("3 steak")?.cat).toBe("fun");
    expect(parseQuickAdd("20")).toEqual({ fils: 20000, name: "Something", cat: "fun" });
    expect(parseQuickAdd("coffee")).toBeNull();
  });
});

describe("suggested limits", () => {
  it("reproduces the design's limits for 500 KWD and always adds up", () => {
    expect(suggestLimits(500000)).toEqual({ food: 110000, transport: 50000, fun: 70000, shopping: 55000, papi: 25000, bills: 190000 });
    const l = suggestLimits(733000);
    expect(Object.values(l).reduce((a, b) => a + b, 0)).toBe(733000);
  });
});

const sp = (id: string, name: string, fils: number, date: string, cat: Spending["cat"] = "food"): Spending => ({ id, name, cat, fils, date, createdAt: Number(id) });

describe("summary", () => {
  const settings = { total: 500000, payday: 25, limits: suggestLimits(500000) };
  it("only counts this period and compares with last period so far", () => {
    const list = [sp("1", "Old", 9000, "2026-10-20"), sp("2", "Older", 1000, "2026-10-01"), sp("3", "Now", 4000, "2026-11-03")];
    const s = summarize(settings, list, "2026-11-03");
    expect(s.spent).toBe(4000);
    expect(s.left).toBe(496000);
    // Previous period 25 Sep to 24 Oct; same point is 4 Oct.
    expect(s.prevSoFar).toBe(1000);
  });
  it("has nothing to compare for a new person", () => {
    expect(summarize(settings, [], "2026-11-03").prevSoFar).toBeNull();
  });
  it("finds usuals from repeated spendings", () => {
    const list = [sp("1", "Latte", 1750, "2026-11-01"), sp("2", "latte", 1800, "2026-11-02"), sp("3", "Taxi", 2500, "2026-11-02", "transport")];
    expect(usuals(list)).toEqual([{ name: "latte", fils: 1800, cat: "food" }]);
  });
  it("asks about deliveries only when it's true", () => {
    const list = [
      sp("1", "Delivery, sushi", 9750, "2026-10-30"),
      sp("2", "Delivery, burgers", 7250, "2026-10-31"),
      sp("3", "Delivery, pasta", 8500, "2026-11-01"),
    ];
    const s = summarize(settings, list, "2026-11-03");
    expect(findQuestion(s, [])?.text).toBe("Three deliveries since Friday. Busy few days?");
    expect(findQuestion(s, ["delivery:2026-10-30"])).toBeNull();
    expect(findQuestion(summarize(settings, list.slice(0, 2), "2026-11-03"), [])).toBeNull();
  });
});
