// Every read and write of the person's data goes through this module, so the
// screens never touch storage directly. Swapping localStorage for Supabase later
// means writing another DataStore and changing `store` below.
import { EMPTY_DATA, type AppData } from "./types";

export interface DataStore {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
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

export const store: DataStore = localStore;

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
