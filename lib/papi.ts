// Papi's voice: quiet, curious, warm, a little needy and playful. Short lines.
// He notices everything and never shames. Everything here is rule-based and
// only states things that are true of the person's real spending.
//
// `papiReply` is the single entry point for chat. When Papi becomes a real AI
// agent, replace its body with a call to a server route; nothing else changes.
import { CAT, CAT_KEYS, type CatKey } from "./categories";
import { guessCategory } from "./quickAdd";
import { addDays, dayMonth, diffDays, relativeDay, weekdayLong, type DateKey } from "./dates";
import { fmt } from "./money";
import type { Summary } from "./summary";
import type { Settings, Spending } from "./types";

export type PapiAnswer = { label: string; you: string; papi: string; memory: string };
export type PapiQuestion = { id: string; text: string; answers: PapiAnswer[] };

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

function sinceWhen(first: DateKey, today: DateKey): string {
  const diff = diffDays(first, today);
  if (diff === 0) return "today";
  if (diff === 1) return "since yesterday";
  return `since ${weekdayLong(first)}`;
}

function deliveryQuestion(s: Summary): PapiQuestion | null {
  const from = addDays(s.today, -6);
  const recent = s.current.filter((t) => t.date >= from && /deliver/i.test(t.name));
  if (recent.length < 3) return null;
  const first = recent.reduce((a, t) => (t.date < a ? t.date : a), recent[0].date);
  const today = first === s.today;
  return {
    id: `delivery:${first}`,
    text: `${countWord(recent.length)} deliveries ${sinceWhen(first, s.today)}. ${today ? "Busy day?" : "Busy few days?"}`,
    answers: [
      {
        label: "Yes, busy",
        you: today ? "Yes, a busy day" : "Yes, a busy few days",
        papi: "Okay. I won’t bring those up again.",
        memory: `Delivery was fine during the busy days from ${dayMonth(first)}`,
      },
      { label: "I just like it", you: "I just really like delivery", papi: "Same. I like tuna.", memory: "You like delivery, and that is allowed" },
    ],
  };
}

function bigOneQuestion(s: Summary): PapiQuestion | null {
  const from = addDays(s.today, -2);
  const threshold = Math.max(20_000, Math.round(s.total * 0.15));
  const big = s.current.find((t) => t.date >= from && t.cat !== "bills" && t.fils >= threshold);
  if (!big) return null;
  return {
    id: `big:${big.id}`,
    text: `${big.name} was a big one. Something special?`,
    answers: [
      { label: "Yes, a one-off", you: "Yes, a one-off", papi: "Good. Special things should be.", memory: `${big.name} on ${dayMonth(big.date)} was a one-off` },
      { label: "It comes every month", you: "It comes every month", papi: "Noted. I’ll expect it.", memory: `${big.name} comes every month` },
    ],
  };
}

/** The one question Papi wants to ask right now, if any. */
export function findQuestion(s: Summary, answered: string[]): PapiQuestion | null {
  for (const rule of [deliveryQuestion, bigOneQuestion]) {
    const q = rule(s);
    if (q && !answered.includes(q.id)) return q;
  }
  return null;
}

export type PapiChip = { label: string; href: string } | { label: string; answer: number };
export type PapiLine = { text: string; chips: PapiChip[] };

/** What Papi says on the Today screen. */
export function papiLine(o: {
  name: string;
  s: Summary;
  hasAnySpending: boolean;
  question: PapiQuestion | null;
  pulse: CatKey | null;
  lastAnswer: string | null;
}): PapiLine {
  const { s } = o;
  if (o.pulse && s.status !== "over") {
    return { text: o.pulse === "papi" ? "For me? Do it again." : "Noted. Thank you.", chips: [] };
  }
  if (s.status === "over") {
    return { text: "We went past the budget. Want to look at it together?", chips: [{ label: "Show me where it went", href: "/insights" }] };
  }
  if (s.status === "close") {
    return { text: "It’s going a little fast. Slow week, maybe?", chips: [{ label: "Show my budgets", href: "/budgets" }] };
  }
  if (o.lastAnswer) return { text: o.lastAnswer, chips: [{ label: "Talk to Papi", href: "/papi" }] };
  if (o.question) return { text: o.question.text, chips: o.question.answers.map((a, i) => ({ label: a.label, answer: i })) };
  if (!o.hasAnySpending) {
    return { text: `Hi ${o.name}. Tell me what you spend and I’ll keep count.`, chips: [] };
  }
  if (s.current.length === 0) {
    return { text: `New month, ${o.name}. Clean slate. I like clean.`, chips: [] };
  }
  return { text: `All quiet, ${o.name}. I like quiet.`, chips: [{ label: "Talk to Papi", href: "/papi" }] };
}

export type ReplyContext = { name: string; s: Summary; settings: Settings; spendings: Spending[] };

const amountIn = (q: string) => {
  const m = q.match(/(\d+)(?:[.,](\d{1,3}))?/);
  if (!m) return null;
  return Number(m[1]) * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
};

function replyNow(q: string, c: ReplyContext): string {
  const { s, settings } = c;
  const lower = q.toLowerCase();
  const cost = amountIn(q);
  const payday = dayMonth(addDays(s.period.end, 1));

  if (cost && /afford|buy|get|can i/.test(lower)) {
    const after = s.left - cost;
    if (after < 0) return `That puts you ${fmt(after)} KWD over for the month. Could it wait until ${payday}?`;
    const cat = guessCategory(q.replace(/\d+([.,]\d+)?/, ""));
    const catOver = s.catSpent[cat] - settings.limits[cat];
    const daily = s.period.daysLeft > 0 ? Math.round(after / s.period.daysLeft) : after;
    return (
      `You’d have ${fmt(after)} KWD left, about ${fmt(daily)} a day.` +
      (catOver > 0 ? ` ${CAT[cat].name} is already ${fmt(catOver)} over, though.` : "") +
      " Is it a very good one?"
    );
  }
  if (/where|most|went/.test(lower)) {
    if (s.spent === 0) return "Nowhere yet. The month is still clean.";
    const top = [...CAT_KEYS].sort((a, b) => s.catSpent[b] - s.catSpent[a])[0];
    return `${CAT[top].name}: ${fmt(s.catSpent[top])} KWD. That’s ${Math.round((s.catSpent[top] / s.spent) * 100)}% of everything so far.`;
  }
  if (/month|going|doing|how am/.test(lower)) {
    const p = s.total > 0 ? Math.round((s.spent / s.total) * 100) : 0;
    const e = Math.round(s.period.elapsedPct);
    const mood = s.left < 0 ? "Let’s look at it together." : s.gap > 12 ? "A little fast. Not scary." : "We’re fine. Pet me.";
    return `${p}% of the money is gone and ${e}% of the month is. ${mood}`;
  }
  if (/you|papi|cost/.test(lower)) {
    const mine = s.catSpent.papi;
    return mine > 0 ? `${fmt(mine)} KWD so far. Worth it. I checked.` : "Nothing yet this month. I’m very affordable.";
  }
  if (/\b(hi|hello|hey|salam)\b/.test(lower)) return `Hi ${c.name}. I’m here.`;
  if (/last|latest|recent/.test(lower)) {
    const t = s.current[0];
    return t ? `${t.name}, ${fmt(t.fils)} KWD, ${relativeDay(t.date, s.today).toLowerCase()}.` : "Nothing yet this month.";
  }
  return "I only understand your spending. Try asking if you can afford something.";
}

/** Papi's chat reply. Async so a real AI agent can replace it without touching the screens. */
export async function papiReply(question: string, context: ReplyContext): Promise<string> {
  return replyNow(question, context);
}

export const CHAT_PROMPTS = ["Can I afford a 40 KWD bag?", "Where did most of it go?", "How’s my month going?", "How much do you cost me?"];
