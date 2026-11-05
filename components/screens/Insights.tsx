"use client";

import Link from "next/link";
import { useState } from "react";
import { byNewest } from "@/lib/budget";
import { addDays, parts, shortDate } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { useReady } from "../AppProvider";
import { SpendingRow } from "../SpendingRow";
import { PapiBust } from "../ui";

export function InsightsScreen() {
  const { summary: s, categories, catOf } = useReady();
  const [hover, setHover] = useState<number | null>(null);

  if (s.current.length === 0) {
    return (
      <div className="page">
        <h1 className="h1">Insights</h1>
        <div className="empty">
          <PapiBust mood="curious" size={120} />
          <p className="papi-words">Nothing to look at yet. Add a spending and I’ll start drawing.</p>
          <p className="muted">Insights show where this budget month’s money goes, day by day.</p>
          <Link href="/" className="btn-solid">
            Add a spending
          </Link>
        </div>
      </div>
    );
  }

  const ranked = categories.map((c) => ({ k: c.id, sp: s.catSpent[c.id] ?? 0 })).sort((a, b) => b.sp - a.sp);
  const topSp = ranked[0].sp || 1;
  const dayNo = s.period.dayIndex + 1;

  const days = Array.from({ length: dayNo }, (_, i) => {
    const date = addDays(s.period.start, i);
    return { date, total: s.current.filter((t) => t.date === date).reduce((a, t) => a + t.fils, 0) };
  });
  const allowance = Math.round(s.total / s.period.days);
  const dayMax = Math.max(allowance, ...days.map((d) => d.total)) * 1.08 || 1;
  const labelEvery = days.length <= 10 ? 1 : days.length <= 20 ? 2 : 3;
  const todayIdx = days.length - 1;

  let line: string;
  const top = `${catOf(ranked[0].k).name} is your biggest category so far.`;
  if (s.prevSoFar === null || s.prevSoFar === 0) {
    line = `This is your first budget month with Purrse, so there’s nothing to compare yet. ${top}`;
  } else {
    const vs = Math.round(((s.spent - s.prevSoFar) / s.prevSoFar) * 100);
    line =
      vs === 0
        ? `You’ve spent about the same as this point last month. ${top}`
        : `You’ve spent ${Math.abs(vs)}% ${vs < 0 ? "less" : "more"} than this point last month. ${top}`;
  }
  const compareMax = Math.max(s.spent, s.prevSoFar ?? 0) || 1;
  const biggest = [...s.current].sort((a, b) => b.fils - a.fils || byNewest(a, b)).slice(0, 3);
  const readout = hover === null ? `Today so far: ${fmt(days[todayIdx].total)} KWD` : `${shortDate(days[hover].date)}: ${fmt(days[hover].total)} KWD`;

  return (
    <div className="page">
      <h1 className="h1">Insights</h1>
      <p className="insight-line">{line}</p>
      <div className="two-grid">
        <section className="panel pad-lg" aria-labelledby="i-where">
          <h2 id="i-where" className="h2 mb">
            Where it went
          </h2>
          <ul className="hbars">
            {ranked.map((r) => (
              <li key={r.k}>
                <div className="hbar-line">
                  <span className="strong">{catOf(r.k).name}</span>
                  <span className="muted num">
                    {fmt(r.sp)} KWD, {s.spent ? Math.round((r.sp / s.spent) * 100) : 0}%
                  </span>
                </div>
                <div className="hbar" style={{ width: `${((r.sp / topSp) * 100).toFixed(1)}%`, minWidth: r.sp ? 4 : 0, background: catOf(r.k).color }} />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel pad-lg" aria-labelledby="i-days">
          <h2 id="i-days" className="h2">
            Day by day
          </h2>
          <p aria-live="polite" className="muted num readout">
            {readout}
          </p>
          <div className={days.length > 16 ? "daychart tight" : "daychart"}>
            <div className="allowance" aria-hidden="true" style={{ bottom: `${((allowance / dayMax) * 100).toFixed(1)}%` }} />
            {days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                className="daybar"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                aria-label={`${shortDate(d.date)}: ${fmt(d.total)} KWD`}
              >
                <span
                  className={i === todayIdx ? "daybar-fill today" : "daybar-fill"}
                  style={{ height: `${((d.total / dayMax) * 100).toFixed(1)}%`, minHeight: d.total ? 3 : 0 }}
                />
              </button>
            ))}
          </div>
          <div className={days.length > 16 ? "daylabels tight" : "daylabels"} aria-hidden="true">
            {days.map((d, i) => (
              <span key={d.date}>{i % labelEvery === 0 || i === todayIdx ? parts(d.date).d : ""}</span>
            ))}
          </div>
          <p className="muted small">Dashed line: your daily budget of {fmt(allowance)} KWD. Hover or tab through the bars for each day.</p>
        </section>

        <section className="panel pad-lg" aria-labelledby="i-compare">
          <h2 id="i-compare" className="h2 mb">
            This month against last
          </h2>
          {s.prevSoFar === null ? (
            <p className="muted">Papi needs one full budget month before he can compare. Check back after your next payday.</p>
          ) : (
            <>
              <ul className="hbars">
                {[
                  { name: "This month", v: s.spent, color: "var(--amber)" },
                  { name: "Last month", v: s.prevSoFar, color: "var(--placeholder)" },
                ].map((r) => (
                  <li key={r.name}>
                    <div className="hbar-line">
                      <span className="strong">{r.name}</span>
                      <span className="muted num">{fmt(r.v)} KWD</span>
                    </div>
                    <div className="hbar thick" style={{ width: `${((r.v / compareMax) * 100).toFixed(1)}%`, background: r.color }} />
                  </li>
                ))}
              </ul>
              <p className="muted small">Both counted up to day {dayNo} of the month.</p>
            </>
          )}
        </section>

        <section className="panel pad-lg" aria-labelledby="i-big">
          <h2 id="i-big" className="h2">
            Biggest spendings
          </h2>
          <ul className="rows">
            {biggest.map((t) => (
              <SpendingRow key={t.id} t={t} sub={shortDate(t.date)} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
