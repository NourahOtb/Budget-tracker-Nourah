"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PRESETS, cleanName, customCategory, presetCategory, type Category } from "@/lib/categories";
import { ordinal } from "@/lib/dates";
import { fmt, parseKwd } from "@/lib/money";
import { newId } from "@/lib/store";
import { useReady } from "../AppProvider";
import { AllocationMessage } from "../Allocation";
import { NewCategoryField, categoryNameProblem } from "../Setup";
import { CatTile, ICONS, Icon } from "../ui";
import { CategoryBar, CategoryStatus } from "./Today";
import { useAuth } from "../Auth";

export function BudgetsScreen() {
  const { summary: s, settings, saveSettings, categories } = useReady();
  const [deleting, setDeleting] = useState<Category | null>(null);
  const allocated = categories.reduce((a, c) => a + c.limit, 0);
  const scale = Math.max(allocated, settings.total);

  const setCategory = (id: string, change: Partial<Category>) =>
    saveSettings({ ...settings, categories: categories.map((c) => (c.id === id ? { ...c, ...change } : c)) });

  return (
    <div className="page">
      <h1 className="h1">Budgets</h1>
      <section aria-label="Monthly total" className="panel total-panel">
        <TotalField />
        <div className="alloc" aria-hidden="true">
          {categories.map((c) => (
            <div key={c.id} style={{ flex: `${c.limit / scale} 1 0`, minWidth: c.limit ? 4 : 0, background: c.color }} />
          ))}
          {allocated < settings.total && <div style={{ flex: `${(settings.total - allocated) / scale} 1 0` }} />}
        </div>
        <AllocationMessage total={settings.total} allocated={allocated} onRaise={() => saveSettings({ ...settings, total: allocated })} />
      </section>

      <div className="two-grid">
        {categories.map((c) => (
          <section key={c.id} aria-labelledby={`b-${c.id}`} className="panel budget-card">
            <CategoryHead
              c={c}
              spent={s.catSpent[c.id] ?? 0}
              canDelete={categories.length > 1}
              onRename={(name) => setCategory(c.id, { name })}
              onDelete={() => setDeleting(c)}
            />
            <CategoryBar spent={s.catSpent[c.id] ?? 0} limit={c.limit} color={c.color} thick />
            <div className="budget-foot">
              <p className="muted num">
                {fmt(s.catSpent[c.id] ?? 0)} of {fmt(c.limit)} KWD
              </p>
              <div className="stepper">
                <button
                  type="button"
                  className="step-btn small"
                  onClick={() => setCategory(c.id, { limit: Math.max(0, c.limit - 5_000) })}
                  aria-label={`Lower ${c.name} budget by 5 KWD`}
                >
                  -
                </button>
                <button
                  type="button"
                  className="step-btn small"
                  onClick={() => setCategory(c.id, { limit: c.limit + 5_000 })}
                  aria-label={`Raise ${c.name} budget by 5 KWD`}
                >
                  +
                </button>
              </div>
            </div>
          </section>
        ))}
        <AddCategory />
      </div>

      <Details />
      <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** The monthly total: type it, or nudge it with − and +. */
function TotalField() {
  const { settings, saveSettings } = useReady();
  const [text, setText] = useState(fmt(settings.total));
  const [error, setError] = useState("");
  const [shownTotal, setShownTotal] = useState(settings.total);

  // Follow changes made by − and + (or another device) unless mid-edit with an error.
  if (shownTotal !== settings.total) {
    setShownTotal(settings.total);
    setText(fmt(settings.total));
    setError("");
  }

  const save = () => {
    const fils = parseKwd(text);
    if (!fils) {
      setError("Type the monthly total in KWD, like 500 or 750.5.");
      return;
    }
    setError("");
    setText(fmt(fils));
    if (fils !== settings.total) saveSettings({ ...settings, total: fils });
  };
  const step = (d: number) => saveSettings({ ...settings, total: Math.max(10_000, settings.total + d) });

  return (
    <form
      className="total-head"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="total-field">
        <label htmlFor="total-input" className="label-muted">
          Monthly total
        </label>
        <div className="total-input-row">
          <input
            id="total-input"
            className="total-input"
            inputMode="decimal"
            value={text}
            style={{ width: `${Math.max(4, text.length) * 0.56 + 0.4}em` }}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            onBlur={save}
            aria-invalid={!!error}
            aria-describedby={error ? "total-error" : "total-help"}
            autoComplete="off"
          />
          <span className="total-unit" aria-hidden="true">
            KWD
          </span>
        </div>
        {error ? (
          <p id="total-error" className="field-error">
            {error}
          </p>
        ) : (
          <p id="total-help" className="sr-only">
            Type an amount and press Enter, or use the buttons to change it by 10 KWD.
          </p>
        )}
      </div>
      <div className="stepper">
        <button type="button" className="step-btn" onClick={() => step(-10_000)} aria-label="Lower monthly total by 10 KWD">
          -
        </button>
        <button type="button" className="step-btn" onClick={() => step(10_000)} aria-label="Raise monthly total by 10 KWD">
          +
        </button>
      </div>
    </form>
  );
}

function CategoryHead({
  c,
  spent,
  canDelete,
  onRename,
  onDelete,
}: {
  c: Category;
  spent: number;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { categories } = useReady();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.name);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  if (editing) {
    const save = (e: FormEvent) => {
      e.preventDefault();
      const n = cleanName(text);
      if (n === c.name) return setEditing(false);
      const problem = categoryNameProblem(n, categories.filter((x) => x.id !== c.id));
      if (problem) return setError(problem);
      onRename(n);
      setEditing(false);
    };
    return (
      <form className="rename" onSubmit={save}>
        <label htmlFor={`rename-${c.id}`} className="sr-only">
          New name for {c.name}
        </label>
        <div className="rename-row">
          <CatTile cat={c} />
          <input
            id={`rename-${c.id}`}
            ref={input}
            className="input"
            value={text}
            maxLength={30}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            aria-invalid={!!error}
          />
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="rename-actions">
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button type="submit" className="btn-solid">
            Save name
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="budget-head">
      <CatTile cat={c} />
      <div className="cat-name">
        <h2 id={`b-${c.id}`} className="h2">
          {c.name}
        </h2>
        <button
          type="button"
          className="icon-btn rename-btn"
          aria-label={`Rename ${c.name}`}
          title="Rename category"
          onClick={() => {
            setText(c.name);
            setEditing(true);
          }}
        >
          <Icon d={ICONS.pencil} size={16} />
        </button>
      </div>
      <div className="head-side">
        <CategoryStatus spent={spent} limit={c.limit} />
        {canDelete && (
          <div className="cat-actions">
            <button type="button" className="icon-btn" aria-label={`Delete ${c.name}`} title="Delete category" onClick={onDelete}>
              <Icon d={ICONS.trash} size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A + card after the categories: opens to add a suggested category back, or type a new one. */
function AddCategory() {
  const { settings, saveSettings, categories } = useReady();
  const [open, setOpen] = useState(false);
  const missing = PRESETS.filter((p) => !categories.some((c) => c.id === p.id));
  const add = (c: Category) => {
    saveSettings({ ...settings, categories: [...categories, c] });
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="panel add-cat-tile" aria-expanded={false} onClick={() => setOpen(true)}>
        <span className="add-cat-plus" aria-hidden="true">
          <Icon d={ICONS.plus} size={28} />
        </span>
        Add a category
      </button>
    );
  }

  return (
    <section aria-labelledby="add-cat-title" className="panel budget-card add-cat">
      <h2 id="add-cat-title" className="h2">
        Add a category
      </h2>
      <p className="muted add-cat-hint">It starts at 0 KWD. Use + on its card to give it a budget.</p>
      {missing.length > 0 && (
        <div className="chips" role="group" aria-label="Suggested categories">
          {missing.map((p) => (
            <button key={p.id} type="button" className="chip cat-chip" onClick={() => add(presetCategory(p))}>
              <Icon d={p.icon} size={18} />
              {p.name}
              <span className="sr-only">, add</span>
            </button>
          ))}
        </div>
      )}
      <NewCategoryField
        id="budgets-new-cat"
        autoFocus
        onCancel={() => setOpen(false)}
        onAdd={(typed) => {
          const n = cleanName(typed);
          const preset = missing.find((p) => p.name.toLowerCase() === n.toLowerCase());
          if (preset) {
            add(presetCategory(preset));
            return null;
          }
          const problem = categoryNameProblem(n, categories);
          if (problem) return problem;
          add(customCategory(newId(), n, categories));
          return null;
        }}
      />
    </section>
  );
}

/** Confirms deleting a category, and moves its spendings somewhere first. */
function DeleteCategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { data, categories, deleteCategory } = useReady();
  const ref = useRef<HTMLDialogElement>(null);
  const others = categories.filter((c) => c.id !== category?.id);
  const count = category ? data.spendings.filter((t) => t.cat === category.id).length : 0;
  const [moveTo, setMoveTo] = useState("");
  const target = others.some((c) => c.id === moveTo) ? moveTo : (others[0]?.id ?? "");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (category && !d.open) d.showModal();
    if (!category && d.open) d.close();
  }, [category]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="del-title" onClose={onClose}>
      {category && (
        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault();
            deleteCategory(category.id, count ? target : null);
            onClose();
          }}
        >
          <h2 id="del-title" className="h2">
            Delete {category.name}?
          </h2>
          {count > 0 ? (
            <>
              <p className="muted del-text">
                {count === 1 ? "1 spending is" : `${count} spendings are`} in {category.name}. Choose where {count === 1 ? "it goes" : "they go"} so
                nothing is lost.
              </p>
              <label htmlFor="move-to" className="field-label">
                Move {count === 1 ? "it" : "them"} to
              </label>
              <select id="move-to" className="input" value={target} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="muted del-text">It has no spendings, so nothing else changes.</p>
          )}
          <div className="dialog-actions">
            <span className="spacer" />
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-solid btn-danger">
              {count > 0 ? "Move and delete" : "Delete"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Details() {
  const { name, settings, setName, saveSettings, resetAll } = useReady();
  const auth = useAuth();
  const [signingOut, setSigningOut] = useState(false);
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
      {auth && (
        <div className="account-zone">
          <p className="muted">
            Signed in as <strong className="account-email">{auth.email}</strong>. Signing out keeps everything safe for next time.
          </p>
          <button
            type="button"
            className="btn-ghost"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await auth.signOut();
              } catch {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
      <div className="danger-zone">
        <p className="muted">
          Want a fresh start? This erases your name, budgets, every spending and photo, and Papi’s notes{auth ? ", but keeps your account" : ""}. Then
          Papi asks for a name again.
        </p>
        <button
          type="button"
          className="btn-ghost danger"
          onClick={() => {
            if (window.confirm(`Erase all of ${name}’s data and start over? This can’t be undone.`)) void resetAll();
          }}
        >
          Erase my data and start over
        </button>
      </div>
    </section>
  );
}
