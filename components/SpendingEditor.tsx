"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { type DateKey } from "@/lib/dates";
import { fmt, parseKwd } from "@/lib/money";
import type { Spending } from "@/lib/types";
import { shrinkImage } from "@/lib/image";
import { useApp } from "./AppProvider";
import { PhotoButton, usePickedPhoto } from "./PhotoPicker";
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
  const { updateSpending, removeSpending, today, photos, categories } = useApp();
  const [name, setName] = useState(spending.name);
  const [amount, setAmount] = useState(fmt(spending.fils));
  const [cat, setCat] = useState<string>(spending.cat);
  const [date, setDate] = useState<DateKey>(spending.date);
  const [error, setError] = useState("");
  const picked = usePickedPhoto();
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  // Photos are private, so each one is shown through a short-lived link.
  const [link, setLink] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!spending.photo || !photos) return;
    let alive = true;
    const path = spending.photo;
    photos.url(path).then(
      (url) => alive && setLink({ path, url }),
      (err) => console.error("Purrse: photo link failed", err),
    );
    return () => {
      alive = false;
    };
  }, [spending.photo, photos]);
  const current = spending.photo && !removePhoto && link?.path === spending.photo ? link.url : null;
  const shown = picked.preview ?? current;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const fils = parseKwd(amount);
    if (!name.trim()) return setError("Give it a name, like Coffee.");
    if (!fils) return setError("Type the amount in KWD, like 4.5.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return setError("Pick a date up to today.");
    let photo = removePhoto ? null : (spending.photo ?? null);
    if (picked.file && photos) {
      setSaving(true);
      try {
        photo = await photos.upload(await shrinkImage(picked.file));
      } catch {
        setSaving(false);
        return setError("The photo didn’t upload. Try again, or remove it.");
      }
    }
    updateSpending({ ...spending, name: name.trim(), fils, cat, date, photo });
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
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip cat-chip"
              aria-pressed={cat === c.id}
              style={cat === c.id ? { background: c.color, color: "var(--ground)" } : undefined}
              onClick={() => setCat(c.id)}
            >
              <Icon d={c.icon} size={18} />
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      {photos && (
        <div className="edit-photo">
          <p className="field-label">Photo</p>
          {shown ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- photo from storage or a local preview */}
              <img src={shown} alt={`Photo of ${name || "this spending"}`} className="photo-full" />
              <div className="chips">
                <PhotoButton label="Replace photo" className="btn-ghost photo-ghost" onPick={(f) => picked.setFile(f)} />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    picked.setFile(null);
                    setRemovePhoto(true);
                  }}
                >
                  Remove photo
                </button>
              </div>
            </>
          ) : (
            <PhotoButton
              label="Add a photo"
              className="btn-ghost photo-ghost"
              onPick={(f) => {
                picked.setFile(f);
                setRemovePhoto(false);
              }}
            />
          )}
        </div>
      )}

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
        <button type="submit" className="btn-solid" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
