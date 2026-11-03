"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, CAT_KEYS, suggestLimits, type CatKey } from "@/lib/categories";
import { ordinal, parts, todayKey } from "@/lib/dates";
import { fmt, parseKwd } from "@/lib/money";
import { useApp } from "./AppProvider";
import { AllocationMessage } from "./Allocation";
import { CatTile, PapiBust } from "./ui";

/** Like parseKwd, but an empty box or 0 means a limit of zero. */
export function parseLimit(text: string): number | null {
  if (/^\s*0*([.,]0*)?\s*$/.test(text)) return 0;
  return parseKwd(text);
}

const asText = (limits: Record<CatKey, number>) =>
  Object.fromEntries(CAT_KEYS.map((k) => [k, fmt(limits[k])])) as Record<CatKey, string>;

export function Setup() {
  const { name, saveSettings, resetAll } = useApp();
  const [totalText, setTotalText] = useState("500");
  const [payday, setPayday] = useState(() => parts(todayKey()).d);
  const [limits, setLimits] = useState(() => asText(suggestLimits(500_000)));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");

  const total = parseKwd(totalText);
  const parsedLimits = Object.fromEntries(CAT_KEYS.map((k) => [k, parseLimit(limits[k])])) as Record<CatKey, number | null>;
  const allValid = CAT_KEYS.every((k) => parsedLimits[k] !== null);
  const allocated = allValid ? CAT_KEYS.reduce((a, k) => a + (parsedLimits[k] ?? 0), 0) : null;

  const onTotal = (v: string) => {
    setTotalText(v);
    setError("");
    const t = parseKwd(v);
    if (t && !touched) setLimits(asText(suggestLimits(t)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!total) {
      setError("Type your monthly budget in KWD, like 500 or 750.5.");
      return;
    }
    if (!allValid) {
      setError("Each category needs an amount in KWD. Use 0 to skip one.");
      return;
    }
    saveSettings({ total, payday, limits: parsedLimits as Record<CatKey, number> });
  };

  return (
    <main className="welcome">
      <form className="setup" onSubmit={submit} noValidate>
        <div className="setup-head">
          <PapiBust mood="playful" size={88} bg="var(--mint)" />
          <div>
            <h1 className="welcome-title">Hi {name}. Let’s set up your month.</h1>
            <p className="welcome-sub">You can change all of this later on the Budgets page.</p>
          </div>
        </div>

        <div className="setup-row">
          <div>
            <label htmlFor="total" className="field-label">
              Monthly budget
            </label>
            <div className="input-unit">
              <input
                id="total"
                className="input"
                inputMode="decimal"
                value={totalText}
                onChange={(e) => onTotal(e.target.value)}
                aria-invalid={!total}
                aria-describedby="total-hint"
              />
              <span aria-hidden="true">KWD</span>
            </div>
            <p id="total-hint" className="field-hint">
              Everything you plan to spend in one month, bills included.
            </p>
          </div>
          <div>
            <label htmlFor="payday" className="field-label">
              Payday
            </label>
            <select id="payday" className="input" value={payday} onChange={(e) => setPayday(Number(e.target.value))} aria-describedby="payday-hint">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  The {ordinal(d)}
                </option>
              ))}
            </select>
            <p id="payday-hint" className="field-hint">
              Your budget month starts on this day. Short months use their last day.
            </p>
          </div>
        </div>

        <fieldset className="setup-cats">
          <legend className="field-label">Category budgets</legend>
          <p className="field-hint">Papi suggested these from your total. Change any of them.</p>
          {CATEGORIES.map((c) => (
            <div key={c.key} className="setup-cat">
              <CatTile cat={c.key} />
              <label htmlFor={`lim-${c.key}`}>{c.name}</label>
              <div className="input-unit input-small">
                <input
                  id={`lim-${c.key}`}
                  className="input"
                  inputMode="decimal"
                  value={limits[c.key]}
                  aria-invalid={parsedLimits[c.key] === null}
                  onChange={(e) => {
                    setTouched(true);
                    setError("");
                    setLimits((l) => ({ ...l, [c.key]: e.target.value }));
                  }}
                />
                <span aria-hidden="true">KWD</span>
              </div>
            </div>
          ))}
          {total && allocated !== null && <AllocationMessage total={total} allocated={allocated} />}
          {touched && total && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setLimits(asText(suggestLimits(total)));
                setTouched(false);
              }}
            >
              Use Papi’s suggestion again
            </button>
          )}
        </fieldset>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="setup-actions">
          <button type="submit" className="btn-solid">
            Start
          </button>
          <button type="button" className="link-btn" onClick={() => void resetAll()}>
            Not {name}? Change name
          </button>
        </div>
      </form>
    </main>
  );
}
