"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { byNewest, inPeriod, periodFor, sumFils, type Period } from "@/lib/budget";
import { CAT, CATEGORIES, type CatKey } from "@/lib/categories";
import { addDays, dayMonth, relativeDay } from "@/lib/dates";
import { fmt } from "@/lib/money";
import type { Spending } from "@/lib/types";
import { useReady } from "../AppProvider";
import { SpendingEditor } from "../SpendingEditor";
import { SpendingRow } from "../SpendingRow";
import { PapiBust } from "../ui";

const PAGE = 60;

export function SpendingScreen() {
  const { summary: s, settings, data, removeSpending } = useReady();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatKey | "all">("all");
  const [periodStart, setPeriodStart] = useState<string>("current");
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<Spending | null>(null);

  // Every budget period that has spendings, newest first, plus the current one.
  const periods = useMemo(() => {
    const out: Period[] = [s.period];
    const oldest = data.spendings.reduce((a, t) => (t.date < a ? t.date : a), s.period.start);
    let p = s.period;
    while (p.start > oldest) {
      p = periodFor(addDays(p.start, -1), settings.payday);
      if (data.spendings.some((t) => inPeriod(t.date, p))) out.push(p);
    }
    return out;
  }, [data.spendings, s.period, settings.payday]);

  const period = periods.find((p) => p.start === periodStart) ?? s.period;
  const q = query.trim().toLowerCase();
  const filtered = data.spendings
    .filter((t) => inPeriod(t.date, period))
    .filter((t) => filter === "all" || t.cat === filter)
    .filter((t) => !q || t.name.toLowerCase().includes(q) || CAT[t.cat].name.toLowerCase().includes(q))
    .sort(byNewest);
  const visible = filtered.slice(0, shown);

  const groups: { date: string; rows: Spending[]; total: number }[] = [];
  for (const t of visible) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.rows.push(t);
    else groups.push({ date: t.date, rows: [t], total: 0 });
  }
  // Day totals count every match on that day, not only the rows shown so far.
  for (const g of groups) g.total = sumFils(filtered.filter((t) => t.date === g.date));

  const nothingAtAll = data.spendings.length === 0;
  const resetPaging = () => setShown(PAGE);

  return (
    <div className="page page-narrow">
      <h1 className="h1">Spending</h1>
      <p className="page-sub">
        {filtered.length} {filtered.length === 1 ? "spending" : "spendings"}, {fmt(sumFils(filtered))} KWD
      </p>

      {nothingAtAll ? (
        <div className="empty">
          <PapiBust mood="curious" size={120} />
          <p className="papi-words">No spendings yet. I’m waiting.</p>
          <p className="muted">Add one on Today, like “4.5 coffee”, and it shows up here.</p>
          <Link href="/" className="btn-solid">
            Add a spending
          </Link>
        </div>
      ) : (
        <>
          <div className="search-row">
            <div className="search-field">
              <label htmlFor="search" className="field-label">
                Search your spendings
              </label>
              <input
                id="search"
                type="search"
                className="input"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPaging();
                }}
                placeholder="delivery, shoes, taxi"
                autoComplete="off"
              />
            </div>
            {periods.length > 1 && (
              <div>
                <label htmlFor="period" className="field-label">
                  Budget month
                </label>
                <select
                  id="period"
                  className="input"
                  value={period.start}
                  onChange={(e) => {
                    setPeriodStart(e.target.value);
                    resetPaging();
                  }}
                >
                  {periods.map((p, i) => (
                    <option key={p.start} value={p.start}>
                      {i === 0 ? "This month" : `${dayMonth(p.start)} to ${dayMonth(p.end)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div role="group" aria-label="Filter by category" className="chips filters">
            {[{ key: "all" as const, name: "All", color: "var(--text)" }, ...CATEGORIES].map((c) => (
              <button
                key={c.key}
                type="button"
                className="chip"
                aria-pressed={filter === c.key}
                style={filter === c.key ? { background: c.color, color: "var(--ground)" } : undefined}
                onClick={() => {
                  setFilter(c.key);
                  resetPaging();
                }}
              >
                {c.name}
              </button>
            ))}
          </div>

          {groups.map((g) => (
            <section key={g.date} className="day-group" aria-labelledby={`d-${g.date}`}>
              <div className="day-head">
                <h2 id={`d-${g.date}`}>{relativeDay(g.date, s.today)}</h2>
                <span>{fmt(g.total)} KWD</span>
              </div>
              <ul className="rows">
                {g.rows.map((t) => (
                  <SpendingRow key={t.id} t={t} sub={CAT[t.cat].name} onEdit={() => setEditing(t)} onRemove={() => removeSpending(t)} />
                ))}
              </ul>
            </section>
          ))}

          {filtered.length > shown && (
            <div className="more">
              <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({filtered.length - shown} left)
              </button>
            </div>
          )}

          {filtered.length === 0 &&
            (q || filter !== "all" ? (
              <div className="empty">
                <p>No spendings match that search.</p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <div className="empty">
                <PapiBust mood="content" size={96} />
                <p className="papi-words">A fresh month. Nothing spent yet.</p>
                <Link href="/" className="btn-solid">
                  Add a spending
                </Link>
              </div>
            ))}
        </>
      )}
      <SpendingEditor spending={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
