// Papi's AI features. Both run in Supabase edge functions, which hold the
// OpenRouter key; the browser only sends the person's own data and gets
// answers back.
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Category } from "./categories";
import { dayMonth, type DateKey } from "./dates";
import { fmt } from "./money";
import { supabase } from "./store";
import type { Summary } from "./summary";
import type { ChatMessage, MemoryItem, Settings, Spending } from "./types";

export const ADVISOR_DAILY_LIMIT = 20;

/** An error an edge function explained, with its code (like "daily_limit"). */
export class AiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function call<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  if (!supabase) throw new AiError("Papi’s AI needs an account.", "offline");
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error || !data) {
    if (error instanceof FunctionsHttpError) {
      const b = await error.context.json().catch(() => null);
      if (b && typeof b.message === "string") throw new AiError(b.message, String(b.error ?? "error"));
    }
    throw new AiError(fallback, "network");
  }
  return data;
}

/** A short, plain-text picture of the person's month for Papi to reason from. */
export function advisorContext(o: {
  name: string;
  settings: Settings;
  summary: Summary;
  spendings: Spending[];
  memory: MemoryItem[];
  catOf: (id: string) => Category;
}): string {
  const { settings, summary: s } = o;
  const kwd = (f: number) => `${f < 0 ? "-" : ""}${fmt(f)} KWD`;
  const lines = [
    `Name: ${o.name}`,
    `Today: ${s.today}. Budget month: ${dayMonth(s.period.start)} to ${dayMonth(s.period.end)} (payday is day ${settings.payday}).`,
    `Day ${s.period.dayIndex + 1} of ${s.period.days}; ${s.period.daysLeft} days left including today.`,
    `Monthly budget: ${kwd(s.total)}. Spent so far: ${kwd(s.spent)}. Left: ${kwd(s.left)}. That's about ${kwd(s.perDay)} a day for the rest of the month.`,
    `Status: ${s.status === "track" ? "on track" : s.status === "close" ? "spending faster than the month is passing" : "over budget"}.`,
    s.prevSoFar !== null ? `Last month by this same day they had spent ${kwd(s.prevSoFar)}.` : "No last month to compare yet.",
    "",
    "Categories (spent / monthly budget / left):",
    ...settings.categories.map((c) => {
      const spent = s.catSpent[c.id] ?? 0;
      return `- ${c.name}: ${kwd(spent)} / ${kwd(c.limit)} / ${kwd(c.limit - spent)}`;
    }),
    `All category budgets together: ${kwd(settings.categories.reduce((a, c) => a + c.limit, 0))} (the monthly budget is ${kwd(s.total)}).`,
    "",
    `This month's spendings, newest first (${s.current.length} in total):`,
    ...s.current.slice(0, 60).map((t) => `- ${t.date} ${t.name}, ${kwd(t.fils)}, ${o.catOf(t.cat).name}`),
  ];
  if (o.memory.length) lines.push("", "Things they told Papi before:", ...o.memory.map((m) => `- ${m.text}`));
  return lines.join("\n");
}

/** Asks Papi the advisor (Purrse Pro). Returns his reply and how many questions are left today. */
export async function askAdvisor(message: string, context: string, history: ChatMessage[]) {
  return call<{ reply: string; left: number }>(
    "papi-advisor",
    { message, context, history: history.slice(-12) },
    "Papi couldn’t reach his advisor brain. Try again in a moment.",
  );
}

export type ReceiptReading = {
  found: boolean;
  fils: number | null;
  name: string | null;
  cat: string | null;
  date: DateKey | null;
  message: string | null;
};

/** Turns a photo into the data URL the edge function expects. */
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Asks Papi to read a receipt photo. */
export async function readReceipt(photo: Blob, categories: Category[], today: DateKey): Promise<ReceiptReading> {
  const image = await toDataUrl(photo);
  const r = await call<Partial<ReceiptReading>>(
    "read-receipt",
    { image, today, categories: categories.map((c) => ({ id: c.id, name: c.name })) },
    "Papi couldn’t read that receipt. Type the amount instead.",
  );
  return {
    found: !!r.found,
    fils: typeof r.fils === "number" && r.fils > 0 ? r.fils : null,
    name: r.name ?? null,
    cat: r.cat && categories.some((c) => c.id === r.cat) ? r.cat : null,
    date: r.date ?? null,
    message: r.message ?? null,
  };
}
