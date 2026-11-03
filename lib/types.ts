import type { CatKey } from "./categories";
import type { DateKey } from "./dates";

export type Spending = {
  id: string;
  name: string;
  cat: CatKey;
  /** Whole fils. */
  fils: number;
  date: DateKey;
  /** Milliseconds; orders spendings within the same day. */
  createdAt: number;
  /** Path of a photo in storage, if one was added. */
  photo?: string | null;
};

export type Settings = {
  /** Monthly total in fils. */
  total: number;
  /** Day of the month the budget period starts (1 to 31; short months use their last day). */
  payday: number;
  limits: Record<CatKey, number>;
};

export type MemoryItem = { id: string; text: string };

export type ChatMessage = { who: "papi" | "you"; text: string };

export type AppData = {
  version: 1;
  profile: { name: string } | null;
  settings: Settings | null;
  spendings: Spending[];
  memory: MemoryItem[];
  chat: ChatMessage[];
  /** Ids of Papi's questions the person has answered, so he never asks twice. */
  answered: string[];
};

export const EMPTY_DATA: AppData = {
  version: 1,
  profile: null,
  settings: null,
  spendings: [],
  memory: [],
  chat: [],
  answered: [],
};
