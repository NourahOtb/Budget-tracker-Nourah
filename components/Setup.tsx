"use client";

import { useState, type FormEvent } from "react";
import { PRESETS, cleanName, customCategory, presetCategory, suggestLimits, type Category } from "@/lib/categories";
import { ordinal, parts, todayKey } from "@/lib/dates";
import { fmt, parseKwd } from "@/lib/money";
import { newId } from "@/lib/store";
import { useApp } from "./AppProvider";
import { AllocationMessage } from "./Allocation";
import { CatTile, ICONS, Icon, PapiBust } from "./ui";

/** Like parseKwd, but an empty box or 0 means a limit of zero. */
export function parseLimit(text: string): number | null {
  if (/^\s*0*([.,]0*)?\s*$/.test(text)) return 0;
  return parseKwd(text);
}

/** Field for typing a new category name, shared by setup and the Budgets page. */
export function NewCategoryField({
  onAdd,
  id,
  autoFocus = false,
  onCancel,
}: {
  onAdd: (name: string) => string | null;
  id: string;
  autoFocus?: boolean;
  /** Shows a Cancel button, and Escape closes the field. */
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const problem = onAdd(text);
    if (problem) setError(problem);
    else {
      setText("");
      setError("");
    }
  };
  return (
    <div className="new-cat">
      <label htmlFor={id} className="field-label">
        Add your own category
      </label>
      <div className="new-cat-row">
        <input
          id={id}
          className="input"
          value={text}
          maxLength={30}
          placeholder="Gym, Gifts, Kids…"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            // Enter adds the category instead of submitting the whole form.
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
            if (e.key === "Escape" && onCancel) {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="button" className="btn-ghost" onClick={add}>
          Add
        </button>
        {onCancel && (
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close without adding">
            <Icon d={ICONS.close} size={18} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Checks a typed name against the categories already there; returns a problem or null. */
export function categoryNameProblem(name: string, existing: Category[]): string | null {
  if (!name) return "Type a name for the category.";
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) return `You already have ${name}.`;
  return null;
}

export function Setup() {
  const { name, saveSettings } = useApp();
  const [totalText, setTotalText] = useState("500");
  const [payday, setPayday] = useState(() => parts(todayKey()).d);
  const [chosen, setChosen] = useState<Category[]>(() => PRESETS.map((p) => presetCategory(p)));
  // Limits the owner typed herself; null while Papi's suggestions are in use.
  const [typed, setTyped] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const total = parseKwd(totalText);
  const suggested = Object.fromEntries(suggestLimits(total ?? 0, chosen).map((c) => [c.id, fmt(c.limit)]));
  const limitText = (id: string) => (typed ? (typed[id] ?? "0") : (suggested[id] ?? "0"));
  const parsedLimits = Object.fromEntries(chosen.map((c) => [c.id, parseLimit(limitText(c.id))]));
  const allValid = chosen.every((c) => parsedLimits[c.id] !== null);
  const allocated = allValid ? chosen.reduce((a, c) => a + (parsedLimits[c.id] ?? 0), 0) : null;

  const togglePreset = (id: string) => {
    setError("");
    setChosen((prev) => {
      if (prev.some((c) => c.id === id)) return prev.filter((c) => c.id !== id);
      // Keep presets in their usual order, ahead of typed categories.
      const presets = PRESETS.filter((p) => p.id === id || prev.some((c) => c.id === p.id)).map(
        (p) => prev.find((c) => c.id === p.id) ?? presetCategory(p),
      );
      return [...presets, ...prev.filter((c) => !PRESETS.some((p) => p.id === c.id))];
    });
  };

  const addCustom = (text: string) => {
    const n = cleanName(text);
    const preset = PRESETS.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (preset && !chosen.some((c) => c.id === preset.id)) {
      togglePreset(preset.id);
      return null;
    }
    const problem = categoryNameProblem(n, chosen);
    if (problem) return problem;
    setError("");
    setChosen((prev) => [...prev, customCategory(newId(), n, prev)]);
    return null;
  };

  const onTotal = (v: string) => {
    setTotalText(v);
    setError("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!total) return setError("Type your monthly budget in KWD, like 500 or 750.5.");
    if (!chosen.length) return setError("Choose at least one category.");
    if (!allValid) return setError("Each category needs an amount in KWD. Use 0 to skip one.");
    saveSettings({ total, payday, categories: chosen.map((c) => ({ ...c, limit: parsedLimits[c.id] ?? 0 })) });
  };

  const customs = chosen.filter((c) => !PRESETS.some((p) => p.id === c.id));

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
          <legend className="field-label">Which categories do you need?</legend>
          <p className="field-hint">Tap to choose. Use + if something’s missing.</p>
          <div className="chips" role="group" aria-label="Suggested categories">
            {PRESETS.map((p) => {
              const on = chosen.some((c) => c.id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="chip cat-chip"
                  aria-pressed={on}
                  style={on ? { background: p.color, color: "var(--ground)" } : undefined}
                  onClick={() => togglePreset(p.id)}
                >
                  <Icon d={p.icon} size={18} />
                  {p.name}
                </button>
              );
            })}
            {customs.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip cat-chip"
                aria-pressed="true"
                aria-label={`Remove ${c.name}`}
                style={{ background: c.color, color: "var(--ground)" }}
                onClick={() => setChosen((prev) => prev.filter((x) => x.id !== c.id))}
              >
                <Icon d={c.icon} size={18} />
                {c.name}
                <Icon d={ICONS.close} size={16} />
              </button>
            ))}
            {!adding && (
              <button type="button" className="chip cat-chip add-chip" aria-expanded={false} onClick={() => setAdding(true)}>
                <Icon d={ICONS.plus} size={18} />
                Add your own
              </button>
            )}
          </div>
          {adding && <NewCategoryField id="setup-new-cat" autoFocus onAdd={addCustom} onCancel={() => setAdding(false)} />}
        </fieldset>

        {chosen.length > 0 && (
          <fieldset className="setup-cats">
            <legend className="field-label">Budget for each</legend>
            <p className="field-hint">Papi suggested these from your total. Change any of them.</p>
            {chosen.map((c) => (
              <div key={c.id} className="setup-cat">
                <CatTile cat={c} />
                <label htmlFor={`lim-${c.id}`}>{c.name}</label>
                <div className="input-unit input-small">
                  <input
                    id={`lim-${c.id}`}
                    className="input"
                    inputMode="decimal"
                    value={limitText(c.id)}
                    aria-invalid={parsedLimits[c.id] === null}
                    onChange={(e) => {
                      const v = e.target.value;
                      setError("");
                      setTyped((t) => ({ ...(t ?? suggested), [c.id]: v }));
                    }}
                  />
                  <span aria-hidden="true">KWD</span>
                </div>
              </div>
            ))}
            {total && allocated !== null && <AllocationMessage total={total} allocated={allocated} />}
            {typed && total && (
              <button type="button" className="link-btn" onClick={() => setTyped(null)}>
                Use Papi’s suggestion again
              </button>
            )}
          </fieldset>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="setup-actions">
          <button type="submit" className="btn-solid">
            Start
          </button>
        </div>
      </form>
    </main>
  );
}
