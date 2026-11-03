"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, CAT_KEYS, type CatKey } from "@/lib/categories";
import { ordinal } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { useReady } from "../AppProvider";
import { AllocationMessage } from "../Allocation";
import { CatTile } from "../ui";
import { CategoryBar, CategoryStatus } from "./Today";

export function BudgetsScreen() {
  const { summary: s, settings, saveSettings } = useReady();
  const allocated = CAT_KEYS.reduce((a, k) => a + settings.limits[k], 0);
  const scale = Math.max(allocated, settings.total);

  const setTotal = (d: number) => saveSettings({ ...settings, total: Math.max(10_000, settings.total + d) });
  const setLimit = (k: CatKey, d: number) =>
    saveSettings({ ...settings, limits: { ...settings.limits, [k]: Math.max(0, settings.limits[k] + d) } });

  return (
    <div className="page">
      <h1 className="h1">Budgets</h1>
      <section aria-label="Monthly total" className="panel total-panel">
        <div className="total-head">
          <div>
            <p className="label-muted">Monthly total</p>
            <p className="total-num">
              {fmt(settings.total)} <span>KWD</span>
            </p>
          </div>
          <div className="stepper">
            <button type="button" className="step-btn" onClick={() => setTotal(-10_000)} aria-label="Lower monthly total by 10 KWD">
              -
            </button>
            <button type="button" className="step-btn" onClick={() => setTotal(10_000)} aria-label="Raise monthly total by 10 KWD">
              +
            </button>
          </div>
        </div>
        <div className="alloc" aria-hidden="true">
          {CATEGORIES.map((c) => (
            <div key={c.key} style={{ flex: `${settings.limits[c.key] / scale} 1 0`, minWidth: settings.limits[c.key] ? 4 : 0, background: c.color }} />
          ))}
          {allocated < settings.total && <div style={{ flex: `${(settings.total - allocated) / scale} 1 0` }} />}
        </div>
        <AllocationMessage total={settings.total} allocated={allocated} />
      </section>

      <div className="two-grid">
        {CATEGORIES.map((c) => (
          <section key={c.key} aria-labelledby={`b-${c.key}`} className="panel budget-card">
            <div className="budget-head">
              <CatTile cat={c.key} />
              <h2 id={`b-${c.key}`} className="h2 grow">
                {c.name}
              </h2>
              <CategoryStatus spent={s.catSpent[c.key]} limit={settings.limits[c.key]} />
            </div>
            <CategoryBar spent={s.catSpent[c.key]} limit={settings.limits[c.key]} color={c.color} thick />
            <div className="budget-foot">
              <p className="muted num">
                {fmt(s.catSpent[c.key])} of {fmt(settings.limits[c.key])} KWD
              </p>
              <div className="stepper">
                <button type="button" className="step-btn small" onClick={() => setLimit(c.key, -5_000)} aria-label={`Lower ${c.name} budget by 5 KWD`}>
                  -
                </button>
                <button type="button" className="step-btn small" onClick={() => setLimit(c.key, 5_000)} aria-label={`Raise ${c.name} budget by 5 KWD`}>
                  +
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <Details />
    </div>
  );
}

function Details() {
  const { name, settings, setName, saveSettings, resetAll } = useReady();
  const [nameText, setNameText] = useState(name);
  const [payday, setPayday] = useState(settings.payday);
  const [saved, setSaved] = useState(false);
  const dirty = nameText.trim() !== name || payday !== settings.payday;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = nameText.trim().replace(/\s+/g, " ");
    if (!n) return;
    if (n !== name) setName(n.slice(0, 40));
    if (payday !== settings.payday) saveSettings({ ...settings, payday });
    setSaved(true);
  };

  return (
    <section aria-labelledby="details-title" className="panel details">
      <h2 id="details-title" className="h2">
        You and your month
      </h2>
      <form onSubmit={submit} className="details-form">
        <div>
          <label htmlFor="d-name" className="field-label">
            What Papi calls you
          </label>
          <input
            id="d-name"
            className="input"
            value={nameText}
            maxLength={40}
            onChange={(e) => {
              setNameText(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div>
          <label htmlFor="d-payday" className="field-label">
            Payday
          </label>
          <select
            id="d-payday"
            className="input"
            value={payday}
            onChange={(e) => {
              setPayday(Number(e.target.value));
              setSaved(false);
            }}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                The {ordinal(d)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={dirty && nameText.trim() ? "btn-solid" : "btn-off"} disabled={!dirty || !nameText.trim()}>
          Save
        </button>
      </form>
      <p role="status" className="muted details-status">
        {saved ? "Saved. Papi noted it." : ""}
      </p>
      <div className="danger-zone">
        <p className="muted">Everything is saved online, so it’s the same on every device. Starting over deletes your budgets, spendings and Papi’s notes everywhere.</p>
        <button
          type="button"
          className="btn-ghost danger"
          onClick={() => {
            if (window.confirm("Start over? This deletes your budgets, every spending and Papi’s notes on every device.")) void resetAll();
          }}
        >
          Start over
        </button>
      </div>
    </section>
  );
}
