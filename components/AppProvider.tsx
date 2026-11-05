"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { moodFor, type Mood } from "@/lib/budget";
import { byId, UNKNOWN_CATEGORY, type Category } from "@/lib/categories";
import { ordinal, todayKey, type DateKey } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { findQuestion, papiReply, type PapiQuestion } from "@/lib/papi";
import { newId, type DataStore } from "@/lib/store";
import { summarize, type Summary } from "@/lib/summary";
import { EMPTY_DATA, type AppData, type Settings, type Spending } from "@/lib/types";

type Toast = { id: number; text: string; undo?: () => void };

type AppCtx = {
  loaded: boolean;
  /** True when loading failed; `retry` tries again. */
  loadFailed: boolean;
  retry(): void;
  data: AppData;
  today: DateKey;
  name: string;
  settings: Settings | null;
  summary: Summary | null;
  /** The owner's categories in order (empty before setup). */
  categories: Category[];
  /** Looks up a category by id, never failing. */
  catOf(id: string): Category;
  question: PapiQuestion | null;
  mood: Mood;
  /** Category of the spending just added, for about 3 seconds. */
  pulse: string | null;
  pulseKey: number;
  lastAnswer: string | null;
  toast: Toast | null;
  papiTyping: boolean;
  /** Photo storage, or null when the store can't hold photos (no Supabase). */
  photos: DataStore["photos"] | null;
  setName(name: string): void;
  saveSettings(settings: Settings): void;
  addSpending(s: { name: string; fils: number; cat: string; date?: DateKey; photo?: string | null }): void;
  updateSpending(s: Spending): void;
  removeSpending(s: Spending): void;
  answerQuestion(q: PapiQuestion, index: number): void;
  forgetMemory(id: string): void;
  /** Deletes a category, first moving its spendings into `moveTo`. */
  deleteCategory(id: string, moveTo: string | null): void;
  ask(text: string): Promise<void>;
  resetAll(): Promise<void>;
  dismissToast(): void;
};

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

/** Same as useApp, for screens that only render once setup is done. */
export function useReady() {
  const app = useApp();
  if (!app.settings || !app.summary) throw new Error("Budget not set up");
  return { ...app, settings: app.settings, summary: app.summary };
}

const PAYDAY_MEMORY = "payday";


export function AppProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Set on mount: the date must come from the visitor's device, never the prerender.
  const [today, setToday] = useState<DateKey>("");
  const [pulse, setPulse] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [papiTyping, setPapiTyping] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    store.load().then(
      (d) => {
        if (!alive) return;
        setToday(todayKey());
        setData(d);
        setLoadFailed(false);
        setLoaded(true);
      },
      (err) => {
        console.error("Purrse: loading failed", err);
        if (alive) setLoadFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [store, attempt]);

  useEffect(() => {
    if (loaded) void store.save(data);
  }, [store, data, loaded]);

  // Keep "today" current across midnight and when the tab comes back.
  useEffect(() => {
    const tick = () => setToday(todayKey());
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(pulseTimer.current);
      clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((text: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    const id = ++toastSeq.current;
    setToast({ id, text, undo });
    toastTimer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 6000);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => setData(fn), []);

  const categories = useMemo(() => data.settings?.categories ?? [], [data.settings]);
  const catOf = useCallback(
    (id: string) => byId(categories)[id] ?? UNKNOWN_CATEGORY,
    [categories],
  );

  const summary = useMemo(
    () => (data.settings && today ? summarize(data.settings, data.spendings, today) : null),
    [data.settings, data.spendings, today],
  );
  const question = useMemo(() => (summary ? findQuestion(summary, data.answered) : null), [summary, data.answered]);
  const mood: Mood = summary
    ? moodFor({ status: summary.status, pulse: !!pulse, gap: summary.gap, hasQuestion: !!question })
    : "content";

  const setName = useCallback((name: string) => update((d) => ({ ...d, profile: { name } })), [update]);

  const saveSettings = useCallback(
    (settings: Settings) =>
      update((d) => {
        const text = `Payday is the ${ordinal(settings.payday)}`;
        const has = d.memory.some((m) => m.id === PAYDAY_MEMORY);
        const memory =
          has || !d.settings
            ? has
              ? d.memory.map((m) => (m.id === PAYDAY_MEMORY ? { ...m, text } : m))
              : [{ id: PAYDAY_MEMORY, text }, ...d.memory]
            : d.memory;
        return { ...d, settings, memory };
      }),
    [update],
  );

  const addSpending = useCallback<AppCtx["addSpending"]>(
    ({ name, fils, cat, date, photo }) => {
      const t: Spending = { id: newId(), name, fils, cat, date: date ?? todayKey(), createdAt: Date.now(), photo: photo ?? null };
      update((d) => ({ ...d, spendings: [t, ...d.spendings] }));
      setLastAnswer(null);
      setPulse(cat);
      setPulseKey((k) => k + 1);
      clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(null), 3200);
      showToast(`Added ${fmt(fils)} KWD to ${catOf(cat).name}`, () => {
        update((d) => ({ ...d, spendings: d.spendings.filter((x) => x.id !== t.id) }));
        setPulse(null);
        dismissToast();
      });
    },
    [update, showToast, dismissToast, catOf],
  );

  const updateSpending = useCallback(
    (t: Spending) => {
      let before: Spending | undefined;
      update((d) => {
        before = d.spendings.find((x) => x.id === t.id);
        return { ...d, spendings: d.spendings.map((x) => (x.id === t.id ? t : x)) };
      });
      showToast(`Saved ${t.name}`, () => {
        if (before) {
          const prev = before;
          update((d) => ({ ...d, spendings: d.spendings.map((x) => (x.id === prev.id ? prev : x)) }));
        }
        dismissToast();
      });
    },
    [update, showToast, dismissToast],
  );

  const removeSpending = useCallback(
    (t: Spending) => {
      update((d) => ({ ...d, spendings: d.spendings.filter((x) => x.id !== t.id) }));
      showToast(`Removed ${t.name}`, () => {
        update((d) => (d.spendings.some((x) => x.id === t.id) ? d : { ...d, spendings: [...d.spendings, t] }));
        dismissToast();
      });
    },
    [update, showToast, dismissToast],
  );

  const answerQuestion = useCallback(
    (q: PapiQuestion, index: number) => {
      const a = q.answers[index];
      update((d) => ({
        ...d,
        answered: [...d.answered, q.id],
        memory: [...d.memory, { id: newId(), text: a.memory }],
        chat: [...d.chat, { who: "papi", text: q.text }, { who: "you", text: a.you }, { who: "papi", text: a.papi }],
      }));
      setLastAnswer(a.papi);
    },
    [update],
  );

  const deleteCategory = useCallback(
    (id: string, moveTo: string | null) =>
      update((d) => {
        if (!d.settings) return d;
        const spendings = moveTo ? d.spendings.map((t) => (t.cat === id ? { ...t, cat: moveTo } : t)) : d.spendings;
        return { ...d, spendings, settings: { ...d.settings, categories: d.settings.categories.filter((c) => c.id !== id) } };
      }),
    [update],
  );

  const forgetMemory = useCallback(
    (id: string) => update((d) => ({ ...d, memory: d.memory.filter((m) => m.id !== id) })),
    [update],
  );

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || !data.settings || !summary) return;
      update((d) => ({ ...d, chat: [...d.chat, { who: "you", text: q }] }));
      setPapiTyping(true);
      try {
        const reply = await papiReply(q, {
          name: data.profile?.name ?? "",
          s: summary,
          settings: data.settings,
          spendings: data.spendings,
        });
        update((d) => ({ ...d, chat: [...d.chat, { who: "papi", text: reply }] }));
      } catch {
        update((d) => ({ ...d, chat: [...d.chat, { who: "papi", text: "I lost my thought. Ask me again?" }] }));
      } finally {
        setPapiTyping(false);
      }
    },
    [data.settings, data.profile, data.spendings, summary, update],
  );

  const resetAll = useCallback(async () => {
    await store.clear();
    setData({ ...EMPTY_DATA });
    setLastAnswer(null);
    setPulse(null);
    dismissToast();
  }, [store, dismissToast]);

  const value: AppCtx = {
    loaded,
    loadFailed,
    retry: () => {
      setLoadFailed(false);
      setAttempt((a) => a + 1);
    },
    data,
    today,
    name: data.profile?.name ?? "",
    settings: data.settings,
    summary,
    categories,
    catOf,
    question,
    mood,
    pulse,
    pulseKey,
    lastAnswer,
    toast,
    papiTyping,
    photos: store.photos ?? null,
    setName,
    saveSettings,
    addSpending,
    updateSpending,
    removeSpending,
    answerQuestion,
    forgetMemory,
    deleteCategory,
    ask,
    resetAll,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
