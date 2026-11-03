// Dates are kept as local calendar days in "YYYY-MM-DD" form. Day maths runs in UTC
// so daylight-saving changes never make a day 23 or 25 hours long.
export type DateKey = string;

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function parts(k: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m: m - 1, d };
}

function utc(k: DateKey): number {
  const { y, m, d } = parts(k);
  return Date.UTC(y, m, d);
}

function fromUtc(ms: number): DateKey {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function makeKey(y: number, m: number, d: number): DateKey {
  return fromUtc(Date.UTC(y, m, d));
}

export function addDays(k: DateKey, n: number): DateKey {
  return fromUtc(utc(k) + n * DAY_MS);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

export function weekday(k: DateKey): string {
  return WEEKDAYS[new Date(utc(k)).getUTCDay()];
}

export function weekdayLong(k: DateKey): string {
  return WEEKDAYS_LONG[new Date(utc(k)).getUTCDay()];
}

/** "25 Oct" */
export function dayMonth(k: DateKey): string {
  const { m, d } = parts(k);
  return `${d} ${MONTHS[m]}`;
}

/** "Sun 25 Oct" */
export function shortDate(k: DateKey): string {
  return `${weekday(k)} ${dayMonth(k)}`;
}

/** "Today", "Yesterday" or "Sun 25 Oct" */
export function relativeDay(k: DateKey, today: DateKey): string {
  const diff = diffDays(k, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return shortDate(k);
}

/** 1 -> "1st", 22 -> "22nd", 25 -> "25th" */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
