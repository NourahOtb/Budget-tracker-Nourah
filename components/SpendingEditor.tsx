"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORIES, type CatKey } from "@/lib/categories";
import { type DateKey } from "@/lib/dates";
import { fmt, parseKwd } from "@/lib/money";
import type { Spending } from "@/lib/types";
import { useApp } from "./AppProvider";
import { ICONS, Icon } from "./ui";

/** Dialog for changing a spending's name, amount, category and date. */
export function SpendingEditor({ spending, onClose }: { spending: Spending | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (spending && !d.open) d.showModal();
    if (!spending && d.open) d.close();
  }, [spending]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="edit-title" onClose={onClose}>
      {spending && <EditorForm key={spending.id} spending={spending} onClose={onClose} />}
    </dialog>
  );
}

function EditorForm({ spending, onClose }: { spending: Spending; onClose: () => void }) {
  const { updateSpending, removeSpending, today } = useApp();
  const [name, setName] = useState(spending.name);
  const [amount, setAmount] = useState(fmt(spending.fils));
  const [cat, setCat] = useState<CatKey>(spending.cat);
  const [date, setDate] = useState<DateKey>(spending.date);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fils = parseKwd(amount);
    if (!name.trim()) return setError("Give it a name, like Coffee.");
    if (!fils) return setError("Type the amount in KWD, like 4.5.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return setError("Pick a date up to today.");
    updateSpending({ ...spending, name: name.trim(), fils, cat, date });
    onClose();
  };

  return (
    <form onSubmit={submit} className="dialog-body" noValidate>
      <div className="dialog-head">
        <h2 id="edit-title" className="h2">
          Edit spending
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close without saving">
          <Icon d={ICONS.close} size={20} />
        </button>
      </div>

      <label htmlFor="edit-name" className="field-label">
        Name
      </label>
      <input id="edit-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />

      <div className="edit-row">
        <div>
          <label htmlFor="edit-amount" className="field-label">
            Amount
          </label>
          <div className="input-unit">
            <input id="edit-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
            <span aria-hidden="true">KWD</span>
          </div>
        </div>
        <div>
          <label htmlFor="edit-date" className="field-label">
            Date
          </label>
          <input id="edit-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <fieldset className="chip-field">
        <legend className="field-label">Category</legend>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className="chip cat-chip"
              aria-pressed={cat === c.key}
              style={cat === c.key ? { background: c.color, color: "var(--ground)" } : undefined}
              onClick={() => setCat(c.key)}
            >
              <Icon d={c.icon} size={18} />
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog-actions">
        <button
          type="button"
          className="btn-ghost danger"
          onClick={() => {
            removeSpending(spending);
            onClose();
          }}
        >
          Remove
        </button>
        <span className="spacer" />
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-solid">
          Save
        </button>
      </div>
    </form>
  );
}
