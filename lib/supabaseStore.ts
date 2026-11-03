// Supabase version of the DataStore. Purrse has a single user and no sign-in,
// so there is one shared set of rows: the same data on every device.
// Saves send only what changed since the last successful save.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CAT_KEYS, type CatKey } from "./categories";
import type { DataStore } from "./store";
import { EMPTY_DATA, type AppData, type Spending } from "./types";

type Tables = {
  profile: { name: string; total_fils: number | null; payday: number | null } | null;
  limits: { category: CatKey; limit_fils: number }[];
  spendings: { id: string; name: string; category: CatKey; fils: number; spent_on: string; created_at: string }[];
  memory: { id: string; text: string; position: number }[];
  chat: { position: number; who: "papi" | "you"; text: string }[];
  answered: { question_id: string }[];
};

function toAppData(t: Tables): AppData {
  if (!t.profile) return { ...EMPTY_DATA };
  const limits = Object.fromEntries(CAT_KEYS.map((k) => [k, 0])) as Record<CatKey, number>;
  for (const l of t.limits) limits[l.category] = Number(l.limit_fils);
  const hasSettings = t.profile.total_fils !== null && t.profile.payday !== null;
  return {
    version: 1,
    profile: { name: t.profile.name },
    settings: hasSettings ? { total: Number(t.profile.total_fils), payday: Number(t.profile.payday), limits } : null,
    spendings: t.spendings.map((s) => ({
      id: s.id,
      name: s.name,
      cat: s.category,
      fils: Number(s.fils),
      date: s.spent_on,
      createdAt: Date.parse(s.created_at),
    })),
    memory: [...t.memory].sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, text: m.text })),
    chat: [...t.chat].sort((a, b) => a.position - b.position).map((m) => ({ who: m.who, text: m.text })),
    answered: t.answered.map((a) => a.question_id),
  };
}

const spendingRow = (s: Spending) => ({
  id: s.id,
  name: s.name,
  category: s.cat,
  fils: s.fils,
  spent_on: s.date,
  created_at: new Date(s.createdAt).toISOString(),
});

const sameSpending = (a: Spending, b: Spending) =>
  a.name === b.name && a.cat === b.cat && a.fils === b.fils && a.date === b.date && a.createdAt === b.createdAt;

function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

// Each table and its key column, used to delete every row when starting over.
const TABLES: [string, string][] = [
  ["spendings", "id"],
  ["category_limits", "category"],
  ["papi_memory", "id"],
  ["chat_messages", "position"],
  ["answered_questions", "question_id"],
  ["profile", "id"],
];

export function supabaseStore(db: SupabaseClient, fallback: DataStore): DataStore {
  // What the database holds, as far as this browser knows.
  let saved: AppData = { ...EMPTY_DATA };
  // Saves run one after another so they never race.
  let queue: Promise<void> = Promise.resolve();

  async function fetchAll(): Promise<AppData> {
    const [profile, limits, spendings, memory, chat, answered] = (
      await Promise.all([
        db.from("profile").select("name, total_fils, payday").maybeSingle(),
        db.from("category_limits").select("category, limit_fils"),
        db.from("spendings").select("id, name, category, fils, spent_on, created_at"),
        db.from("papi_memory").select("id, text, position"),
        db.from("chat_messages").select("position, who, text"),
        db.from("answered_questions").select("question_id"),
      ])
    ).map(check);
    return toAppData({
      profile: profile.data,
      limits: limits.data ?? [],
      spendings: spendings.data ?? [],
      memory: memory.data ?? [],
      chat: chat.data ?? [],
      answered: answered.data ?? [],
    } as Tables);
  }

  async function write(next: AppData) {
    const prev = saved;

    if (next.profile && (next.profile !== prev.profile || next.settings !== prev.settings)) {
      check(
        await db.from("profile").upsert({
          id: 1,
          name: next.profile.name,
          total_fils: next.settings?.total ?? null,
          payday: next.settings?.payday ?? null,
        }),
      );
    }

    if (next.settings && next.settings.limits !== prev.settings?.limits) {
      const rows = CAT_KEYS.map((k) => ({ category: k, limit_fils: next.settings!.limits[k] }));
      check(await db.from("category_limits").upsert(rows));
    }

    if (next.spendings !== prev.spendings) {
      const before = new Map(prev.spendings.map((s) => [s.id, s]));
      const now = new Set(next.spendings.map((s) => s.id));
      const changed = next.spendings.filter((s) => !before.has(s.id) || !sameSpending(before.get(s.id)!, s));
      const removed = prev.spendings.filter((s) => !now.has(s.id)).map((s) => s.id);
      if (changed.length) check(await db.from("spendings").upsert(changed.map(spendingRow)));
      if (removed.length) check(await db.from("spendings").delete().in("id", removed));
    }

    if (next.memory !== prev.memory) {
      const now = new Set(next.memory.map((m) => m.id));
      const removed = prev.memory.filter((m) => !now.has(m.id)).map((m) => m.id);
      if (removed.length) check(await db.from("papi_memory").delete().in("id", removed));
      if (next.memory.length) {
        check(await db.from("papi_memory").upsert(next.memory.map((m, position) => ({ id: m.id, text: m.text, position }))));
      }
    }

    if (next.chat !== prev.chat) {
      // The chat only ever grows, except when everything is reset.
      let from = prev.chat.length;
      if (next.chat.length < from) {
        check(await db.from("chat_messages").delete().gte("position", 0));
        from = 0;
      }
      const rows = next.chat.slice(from).map((m, i) => ({ position: from + i, who: m.who, text: m.text }));
      if (rows.length) check(await db.from("chat_messages").upsert(rows));
    }

    if (next.answered !== prev.answered) {
      const fresh = next.answered.filter((q) => !prev.answered.includes(q));
      if (fresh.length) check(await db.from("answered_questions").upsert(fresh.map((question_id) => ({ question_id }))));
    }

    saved = next;
  }

  return {
    async load() {
      try {
        saved = await fetchAll();
        if (saved.profile) return saved;
        // Nothing in Supabase yet: bring over anything this browser saved locally.
        const local = await fallback.load();
        if (local.profile) {
          await write(local);
          await fallback.clear();
        }
        return local;
      } catch (err) {
        // Supabase unreachable: show what this browser has rather than nothing.
        console.error("Purrse: loading from Supabase failed", err);
        return fallback.load();
      }
    },

    save(data) {
      queue = queue
        .then(() => (data.profile ? write(data) : undefined))
        .catch((err) => {
          // Keep `saved` as it was so the next save retries what didn't make it.
          console.error("Purrse: saving to Supabase failed", err);
        });
      return queue;
    },

    async clear() {
      await queue;
      for (const [table, key] of TABLES) {
        // PostgREST needs a filter on delete; every row matches this one.
        const { error } = await db.from(table).delete().not(key, "is", null);
        if (error) console.error(`Purrse: clearing ${table} failed`, error);
      }
      saved = { ...EMPTY_DATA };
      await fallback.clear();
    },
  };
}
