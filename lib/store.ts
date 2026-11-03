// Every read and write of the person's data goes through this module, so the
// screens never touch storage directly. With Supabase keys set, data lives in
// Supabase; without them, it stays in this browser's localStorage.
import { createClient } from "@supabase/supabase-js";
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
    url(path: string): string;
  };
}

const KEY = "purrse:v1";

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
      return isAppData(parsed) ? { ...EMPTY_DATA, ...parsed } : { ...EMPTY_DATA };
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

export const store: DataStore =
  SUPABASE_URL && SUPABASE_KEY ? supabaseStore(createClient(SUPABASE_URL, SUPABASE_KEY), localStore) : localStore;

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
