"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { categoryState } from "@/lib/budget";
import { AiError, readReceipt, type ReceiptReading } from "@/lib/ai";
import { relativeDay, shortDate, type DateKey } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { papiLine } from "@/lib/papi";
import { shrinkImage } from "@/lib/image";
import { parseQuickAdd } from "@/lib/quickAdd";
import { usuals } from "@/lib/summary";
import type { Spending } from "@/lib/types";
import { useReady } from "../AppProvider";
import { PhotoButton, usePickedPhoto } from "../PhotoPicker";
import { SpendingEditor } from "../SpendingEditor";
import { SpendingRow } from "../SpendingRow";
import { CatTile, Icon, PapiBust } from "../ui";

/** Counts smoothly toward a number; jumps straight there with reduced motion. */
function useCountTo(target: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / 520);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      shownRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

function Hero() {
  const { summary: s, mood, pulse, pulseKey } = useReady();
  const shown = useCountTo(Math.abs(s.left));
  const [whole, frac] = fmt(shown).split(".");
  const { daysLeft } = s.period;
  const over = s.status === "over";
  const sub = over
    ? `Nobody’s in trouble. ${daysLeft === 1 ? "Payday is tomorrow." : `${daysLeft} days until payday.`}`
    : (daysLeft === 1 ? `${fmt(s.perDay)} KWD for today, the last day before payday.` : `About ${fmt(s.perDay)} KWD a day for the next ${daysLeft} days.`) +
      (s.status === "close" ? " Getting close." : "");
  const spentPct = s.total > 0 ? Math.min(100, (s.spent / s.total) * 100) : 100;

  return (
    <div className="hero-wrap">
      <section aria-label="Money left this month" className={`hero status-${s.status}`} style={{ "--w": whole.length } as CSSProperties}>
        <div className="hero-text">
          <p className="hero-label">{over ? "Over budget by" : "Left to spend"}</p>
          <p className={pulseKey ? "hero-num pop" : "hero-num"} key={pulseKey}>
            <span>{whole}</span>
            <span className="hero-frac">.{frac}</span>
            <span className="hero-unit">KWD</span>
          </p>
          <p className="hero-sub">{sub}</p>
          <div className="hero-bar">
            <div className="hero-track">
              <div className="hero-fill" style={{ width: `${spentPct.toFixed(1)}%` }} />
              <div className="hero-mark" aria-hidden="true" style={{ insetInlineStart: `${s.period.elapsedPct.toFixed(1)}%` }} />
            </div>
            <p className="hero-bartext">
              {fmt(s.spent)} of {fmt(s.total)} spent. White mark: today.
            </p>
          </div>
        </div>
        <Image
          key={pulse ? `w${pulseKey}` : "still"}
          className={pulse ? "lounge wiggle" : "lounge"}
          src={`/papi/lounge-${mood}.svg`}
          alt={`Papi the cat, ${mood}, lying on the card with his white paws hanging over the edge`}
          width={560}
          height={450}
          unoptimized
          priority
        />
      </section>
    </div>
  );
}

type Reading =
  | { state: "reading" }
  | { state: "done"; result: ReceiptReading; filled: boolean }
  | { state: "failed"; text: string };

function AddForm() {
  const { addSpending, data, photos, categories, today, catOf } = useReady();
  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState<string | null>(null);
  // The receipt's own date, when Papi read one; otherwise the spending is dated today.
  const [draftDate, setDraftDate] = useState<DateKey | null>(null);
  const photo = usePickedPhoto();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  // Ignores a reading that finishes after the photo was changed or removed.
  const readSeq = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const fillFrom = (r: ReceiptReading) => {
    if (!r.fils) return;
    // Receipts often print names in capitals; "THE SULTAN CENTER" reads better as "The Sultan Center".
    const name = r.name && r.name === r.name.toUpperCase() ? r.name.toLowerCase().replace(/(^|\s)\p{L}/gu, (ch) => ch.toUpperCase()) : r.name;
    setDraft(`${fmt(r.fils)} ${name ?? "Receipt"}`);
    setDraftCat(r.cat);
    setDraftDate(r.date && r.date <= today ? r.date : null);
  };

  const clearPhoto = () => {
    readSeq.current++;
    photo.setFile(null);
    setReading(null);
    setDraftDate(null);
  };

  const pickPhoto = async (f: File) => {
    photo.setFile(f);
    setPhotoError("");
    const seq = ++readSeq.current;
    setReading({ state: "reading" });
    try {
      const result = await readReceipt(await shrinkImage(f), categories, today);
      if (seq !== readSeq.current) return;
      // Fill the form only if the person hasn't started typing their own.
      const filled = !!result.fils && !draftRef.current.trim();
      if (filled) fillFrom(result);
      setReading({ state: "done", result, filled });
      if (filled) input.current?.focus();
    } catch (err) {
      if (seq !== readSeq.current) return;
      setReading({ state: "failed", text: err instanceof AiError ? err.message : "Papi couldn’t read that receipt. Type the amount instead." });
    }
  };
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const parsed = parseQuickAdd(draft, categories);
  const cat = draftCat ?? parsed?.cat ?? null;
  const usual = useMemo(
    () => usuals(data.spendings.filter((t) => categories.some((c) => c.id === t.cat))),
    [data.spendings, categories],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed || !cat || uploading) return;
    let path: string | null = null;
    if (photo.file && photos) {
      setUploading(true);
      setPhotoError("");
      try {
        path = await photos.upload(await shrinkImage(photo.file));
      } catch {
        setPhotoError("The photo didn’t upload. Try again, or remove it to add without a photo.");
        return;
      } finally {
        setUploading(false);
      }
    }
    addSpending({ name: parsed.name, fils: parsed.fils, cat, photo: path, date: draftDate ?? undefined });
    setDraft("");
    setDraftCat(null);
    clearPhoto();
  };

  return (
    <form onSubmit={submit} className="panel add">
      <label htmlFor="add" className="h3">
        Add a spending
      </label>
      <div className="add-row">
        <input
          id="add"
          ref={input}
          className="input input-big"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDraftCat(null);
            if (!e.target.value.trim()) setDraftDate(null);
          }}
          placeholder={photo.file ? "Papi fills this from the photo" : "4.5 coffee"}
          autoComplete="off"
          aria-describedby="add-hint"
        />
        {photos && (
          <PhotoButton
            label={photo.file ? "Change photo" : "Add a photo or receipt"}
            onPick={(f) => void pickPhoto(f)}
          />
        )}
        <button type="submit" className={parsed && !uploading ? "btn-solid add-btn" : "btn-off add-btn"} disabled={!parsed || uploading}>
          {uploading ? "Saving…" : parsed ? `Add ${fmt(parsed.fils)}` : "Add"}
        </button>
      </div>
      <p id="add-hint" className="sr-only">
        Type an amount and what it was for, like 4.5 coffee.
      </p>
      {photo.preview && (
        <div className="photo-draft">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
          <img src={photo.preview} alt="Photo to attach" />
          <span className="muted">Photo will be added with this spending.</span>
          <button type="button" className="link-btn" onClick={clearPhoto}>
            Remove photo
          </button>
        </div>
      )}
      <div role="status" aria-live="polite">
        {reading?.state === "reading" && <p className="receipt-note busy">Papi is reading your receipt…</p>}
        {reading?.state === "done" && reading.result.fils && (
          <div className="receipt-note good">
            <p>
              Papi read <strong className="num">{fmt(reading.result.fils)} KWD</strong>
              {reading.result.name ? ` at ${reading.result.name}` : ""}
              {reading.result.date && reading.result.date !== today ? `, on ${shortDate(reading.result.date)}` : ""}
              {reading.result.cat ? `, for ${catOf(reading.result.cat).name}` : ""}.{" "}
              {reading.filled ? "Check it, then tap Add." : ""}
            </p>
            {!reading.filled && (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  fillFrom(reading.result);
                  setReading({ ...reading, filled: true });
                }}
              >
                Use Papi’s reading
              </button>
            )}
          </div>
        )}
        {reading?.state === "done" && !reading.result.fils && reading.result.message && (
          <p className="receipt-note warn">{reading.result.message}</p>
        )}
        {reading?.state === "failed" && <p className="receipt-note warn">{reading.text}</p>}
      </div>
      {photoError && (
        <p className="field-error" role="alert">
          {photoError}
        </p>
      )}
      {parsed ? (
        <div className="add-cats">
          <p className="muted">
            {parsed.name} goes in{draftDate ? ` (dated ${shortDate(draftDate)})` : ""}:
          </p>
          <div className="chips" role="group" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip cat-chip"
                aria-pressed={cat === c.id}
                style={cat === c.id ? { background: c.color, color: "var(--ground)" } : undefined}
                onClick={() => setDraftCat(c.id)}
              >
                <Icon d={c.icon} size={18} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : usual.length ? (
        <div className="usuals">
          <span className="muted">Your usuals</span>
          {usual.map((u) => (
            <button
              key={u.name}
              type="button"
              className="chip"
              onClick={() => {
                setDraft(`${fmt(u.fils)} ${u.name}`);
                setDraftCat(u.cat);
                input.current?.focus();
              }}
            >
              {u.name} {fmt(u.fils)}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted usuals-empty">Type an amount and what it was for. Papi learns your usuals as you go.</p>
      )}
    </form>
  );
}

export function CategoryStatus({ spent, limit }: { spent: number; limit: number }) {
  const st = categoryState(spent, limit);
  const text = st.kind === "over" ? `Over by ${fmt(-st.left)}` : `${st.kind === "close" ? "Close, " : ""}${fmt(st.left)} left`;
  return <span className={`cat-status ${st.kind}`}>{text}</span>;
}

export function CategoryBar({ spent, limit, color, thick }: { spent: number; limit: number; color: string; thick?: boolean }) {
  const st = categoryState(spent, limit);
  return (
    <div className={thick ? "bar bar-thick" : "bar"}>
      <div className="bar-fill" style={{ width: `${Math.min(100, st.pct).toFixed(1)}%`, background: st.kind === "over" ? "var(--coral)" : color }} />
    </div>
  );
}

function Glance() {
  const { summary: s, categories } = useReady();
  return (
    <section aria-labelledby="glance-title" className="glance">
      <div className="section-head">
        <h2 id="glance-title" className="h2">
          Budgets at a glance
        </h2>
        <Link href="/budgets" className="text-link">
          Change budgets
        </Link>
      </div>
      <ul className="glance-grid">
        {categories.map((c) => (
          <li key={c.id} className="glance-item">
            <CatTile cat={c} />
            <div className="glance-body">
              <div className="glance-line">
                <span className="strong">{c.name}</span>
                <CategoryStatus spent={s.catSpent[c.id] ?? 0} limit={c.limit} />
              </div>
              <CategoryBar spent={s.catSpent[c.id] ?? 0} limit={c.limit} color={c.color} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PapiPanel() {
  const { summary: s, name, mood, pulse, question, lastAnswer, data, answerQuestion } = useReady();
  const line = papiLine({ name, s, hasAnySpending: data.spendings.length > 0, question, pulse, lastAnswer });
  return (
    <section aria-label="Papi says" className="panel papi-panel">
      <div className="papi-say">
        <PapiBust mood={mood} />
        <div className="papi-say-text">
          <p className="papi-name">Papi</p>
          <p className="papi-words" aria-live="polite">
            {line.text}
          </p>
        </div>
      </div>
      {line.chips.length > 0 && (
        <div className="chips">
          {line.chips.map((c) =>
            "href" in c ? (
              <Link key={c.label} href={c.href} className="chip">
                {c.label}
              </Link>
            ) : (
              <button key={c.label} type="button" className="chip" onClick={() => question && answerQuestion(question, c.answer)}>
                {c.label}
              </button>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function Latest() {
  const { summary: s, data } = useReady();
  const [editing, setEditing] = useState<Spending | null>(null);
  const latest = s.current.slice(0, 6);
  return (
    <section aria-labelledby="latest-title">
      <div className="section-head">
        <h2 id="latest-title" className="h2">
          Latest
        </h2>
        {latest.length > 0 && (
          <Link href="/spending" className="text-link">
            See all
          </Link>
        )}
      </div>
      {latest.length ? (
        <ul className="rows">
          {latest.map((t) => (
            <SpendingRow key={t.id} t={t} sub={relativeDay(t.date, s.today)} onEdit={() => setEditing(t)} />
          ))}
        </ul>
      ) : (
        <div className="empty-small">
          <p>{data.spendings.length ? "Nothing yet this budget month." : "Nothing here yet."}</p>
          <p className="muted">Add your first spending above and it shows up here.</p>
        </div>
      )}
      <SpendingEditor spending={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

export function TodayScreen() {
  return (
    <div className="today-grid">
      <div className="col">
        <Hero />
        <AddForm />
        <Glance />
      </div>
      <div className="col col-side">
        <PapiPanel />
        <Latest />
      </div>
    </div>
  );
}
