// Every read and write of the person's data goes through this module, so the
// screens never touch storage directly. With Supabase keys set, each signed-in
// person's data lives in Supabase; without them, it stays in this browser's
// localStorage and there is no sign-in.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PRESETS, presetCategory } from "./categories";
import { supabaseStore } from "./supabaseStore";
import { EMPTY_DATA, type AppData } from "./types";

export interface DataStore {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
  /** Photo storage, when the store has somewhere to put them. */
  photos?: {
    /** Uploads an image and returns its storage path. */
    upload(image: Blob): Promise<string>;
    /** A short-lived link for showing a photo. */
    url(path: string): Promise<string>;
  };
}

const KEY = "purrse:v1";

// Data saved before categories were editable kept a fixed `limits` map instead.
function upgrade(d: AppData): AppData {
  const s = d.settings as (AppData["settings"] & { limits?: Record<string, number> }) | null;
  if (!s || s.categories || !s.limits) return d;
  const categories = PRESETS.map((p) => presetCategory(p, s.limits?.[p.id] ?? 0));
  return { ...d, settings: { total: s.total, payday: s.payday, categories } };
}

function isAppData(v: unknown): v is AppData {
  if (!v || typeof v !== "object") return false;
  const d = v as Partial<AppData>;
  return d.version === 1 && Array.isArray(d.spendings) && Array.isArray(d.memory) && Array.isArray(d.chat) && Array.isArray(d.answered);
}

export const localStore: DataStore = {
  async load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return { ...EMPTY_DATA };
      const parsed: unknown = JSON.parse(raw);
      return isAppData(parsed) ? upgrade({ ...EMPTY_DATA, ...parsed }) : { ...EMPTY_DATA };
    } catch {
      return { ...EMPTY_DATA };
    }
  },
  async save(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage can be full or blocked (private mode). The app keeps working in memory.
    }
  },
  async clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Nothing to clear.
    }
  },
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** The Supabase client, or null when the app runs on this browser alone. */
export const supabase: SupabaseClient | null = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/** The store for one signed-in person, or this browser's store without Supabase. */
export function storeFor(userId: string | null): DataStore {
  return supabase && userId ? supabaseStore(supabase, userId) : localStore;
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
