// Supabase version of the DataStore, for one signed-in person. Row level
// security means they can only ever read or change their own rows, and
// photos live in a private folder named after their user id.
// Saves send only what changed since the last successful save.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "./categories";
import type { DataStore } from "./store";
import { EMPTY_DATA, type AppData, type Spending } from "./types";

type Tables = {
  profile: { name: string; total_fils: number | null; payday: number | null } | null;
  categories: { id: string; name: string; color: string; icon: string; limit_fils: number; position: number }[];
  spendings: { id: string; name: string; category: string; fils: number; spent_on: string; created_at: string; photo_path: string | null }[];
  memory: { id: string; text: string; position: number }[];
  chat: { position: number; who: "papi" | "you"; text: string }[];
  answered: { question_id: string }[];
};

function toAppData(t: Tables): AppData {
  if (!t.profile) return { ...EMPTY_DATA };
  const categories: Category[] = [...t.categories]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, color: c.color, icon: c.icon, limit: Number(c.limit_fils) }));
  const hasSettings = t.profile.total_fils !== null && t.profile.payday !== null && categories.length > 0;
  return {
    version: 1,
    profile: { name: t.profile.name },
    settings: hasSettings ? { total: Number(t.profile.total_fils), payday: Number(t.profile.payday), categories } : null,
    spendings: t.spendings.map((s) => ({
      id: s.id,
      name: s.name,
      cat: s.category,
      fils: Number(s.fils),
      date: s.spent_on,
      createdAt: Date.parse(s.created_at),
      photo: s.photo_path,
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
  photo_path: s.photo ?? null,
});

const sameCategory = (a: Category, b: Category) =>
  a.name === b.name && a.color === b.color && a.icon === b.icon && a.limit === b.limit;

const sameSpending = (a: Spending, b: Spending) =>
  a.name === b.name && a.cat === b.cat && a.fils === b.fils && a.date === b.date && a.createdAt === b.createdAt && (a.photo ?? null) === (b.photo ?? null);

function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

// Each table and its key column, used to delete every row when starting over.
// Spendings go before categories because each spending points at its category.
const TABLES: [string, string][] = [
  ["spendings", "id"],
  ["categories", "id"],
  ["papi_memory", "id"],
  ["chat_messages", "position"],
  ["answered_questions", "question_id"],
  ["profile", "user_id"],
];

const BUCKET = "spending-photos";
// How long a photo outlives the spending that used it, so Undo can bring it back.
const PHOTO_GRACE_MS = 15_000;

export function supabaseStore(db: SupabaseClient, userId: string): DataStore {
  const mine = <T extends object>(row: T) => ({ ...row, user_id: userId });
  // What the database holds, as far as this browser knows.
  let saved: AppData = { ...EMPTY_DATA };
  // Saves run one after another so they never race.
  let queue: Promise<void> = Promise.resolve();

  // Deletes photos no spending uses any more, once Undo has had its chance.
  function forgetPhotos(paths: string[]) {
    if (!paths.length) return;
    setTimeout(() => {
      const inUse = new Set(saved.spendings.map((s) => s.photo).filter(Boolean));
      const unused = paths.filter((p) => !inUse.has(p));
      if (unused.length) {
        void db.storage.from(BUCKET).remove(unused).then(({ error }) => {
          if (error) console.error("Purrse: deleting photos failed", error);
        });
      }
    }, PHOTO_GRACE_MS);
  }

  async function fetchAll(): Promise<AppData> {
    const [profile, categories, spendings, memory, chat, answered] = (
      await Promise.all([
        db.from("profile").select("name, total_fils, payday").maybeSingle(),
        db.from("categories").select("id, name, color, icon, limit_fils, position"),
        db.from("spendings").select("id, name, category, fils, spent_on, created_at, photo_path"),
        db.from("papi_memory").select("id, text, position"),
        db.from("chat_messages").select("position, who, text"),
        db.from("answered_questions").select("question_id"),
      ])
    ).map(check);
    return toAppData({
      profile: profile.data,
      categories: categories.data ?? [],
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
          user_id: userId,
          name: next.profile.name,
          total_fils: next.settings?.total ?? null,
          payday: next.settings?.payday ?? null,
        }),
      );
    }

    // New and changed categories go first, so spendings moved into them can point at them.
    const nextCats = next.settings?.categories ?? [];
    const prevCats = prev.settings?.categories ?? [];
    if (nextCats !== prevCats) {
      const before = new Map(prevCats.map((c, i) => [c.id, { c, i }]));
      const rows = nextCats
        .map((c, position) => ({ c, position }))
        .filter(({ c, position }) => {
          const b = before.get(c.id);
          return !b || b.i !== position || !sameCategory(b.c, c);
        })
        .map(({ c, position }) => mine({ id: c.id, name: c.name, color: c.color, icon: c.icon, limit_fils: c.limit, position }));
      if (rows.length) check(await db.from("categories").upsert(rows));
    }

    if (next.spendings !== prev.spendings) {
      const before = new Map(prev.spendings.map((s) => [s.id, s]));
      const now = new Set(next.spendings.map((s) => s.id));
      const changed = next.spendings.filter((s) => !before.has(s.id) || !sameSpending(before.get(s.id)!, s));
      const removed = prev.spendings.filter((s) => !now.has(s.id)).map((s) => s.id);
      if (changed.length) check(await db.from("spendings").upsert(changed.map((x) => mine(spendingRow(x)))));
      if (removed.length) check(await db.from("spendings").delete().in("id", removed));
      const stillUsed = new Set(next.spendings.map((s) => s.photo));
      forgetPhotos([...new Set(prev.spendings.map((s) => s.photo).filter((p): p is string => !!p && !stillUsed.has(p)))]);
    }

    // Deleted categories go last, once none of their spendings point at them.
    if (nextCats !== prevCats) {
      const now = new Set(nextCats.map((c) => c.id));
      const removed = prevCats.filter((c) => !now.has(c.id)).map((c) => c.id);
      if (removed.length) check(await db.from("categories").delete().in("id", removed));
    }

    if (next.memory !== prev.memory) {
      const now = new Set(next.memory.map((m) => m.id));
      const removed = prev.memory.filter((m) => !now.has(m.id)).map((m) => m.id);
      if (removed.length) check(await db.from("papi_memory").delete().in("id", removed));
      if (next.memory.length) {
        check(await db.from("papi_memory").upsert(next.memory.map((m, position) => mine({ id: m.id, text: m.text, position }))));
      }
    }

    if (next.chat !== prev.chat) {
      // The chat only ever grows, except when everything is reset.
      let from = prev.chat.length;
      if (next.chat.length < from) {
        check(await db.from("chat_messages").delete().gte("position", 0));
        from = 0;
      }
      const rows = next.chat.slice(from).map((m, i) => mine({ position: from + i, who: m.who, text: m.text }));
      if (rows.length) check(await db.from("chat_messages").upsert(rows));
    }

    if (next.answered !== prev.answered) {
      const fresh = next.answered.filter((q) => !prev.answered.includes(q));
      if (fresh.length) check(await db.from("answered_questions").upsert(fresh.map((question_id) => mine({ question_id }))));
    }

    saved = next;
  }

  return {
    photos: {
      async upload(image) {
        const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await db.storage.from(BUCKET).upload(path, image, { contentType: image.type || "image/jpeg" });
        if (error) throw error;
        return path;
      },
      async url(path) {
        const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        if (error) throw error;
        return data.signedUrl;
      },
    },

    async load() {
      // Errors reach the app, which offers to try again. Showing empty data
      // instead would let the next save overwrite what's really there.
      saved = await fetchAll();
      return saved;
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
      const photos = saved.spendings.map((s) => s.photo).filter((p): p is string => !!p);
      if (photos.length) await db.storage.from(BUCKET).remove(photos);
      saved = { ...EMPTY_DATA };
    },
  };
}
