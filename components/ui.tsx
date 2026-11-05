import Image from "next/image";
import type { Mood } from "@/lib/budget";
import type { Category } from "@/lib/categories";

export const ICONS = {
  today: "M3 11l9-8 9 8M5 10v10h14V10",
  spending: "M4 6h16M4 12h16M4 18h10",
  budgets: "M12 3a9 9 0 1 0 9 9h-9z",
  insights: "M5 20V11M12 20V4M19 20v-6",
  papi: "M5 3l3 5a8 8 0 0 1 8 0l3-5 1 11a8 8 0 0 1-16 0zM9 13h.01M15 13h.01M9.5 17c1-1 2-1 2.5 0 .5-1 1.5-1 2.5 0",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  close: "M6 6l12 12M18 6L6 18",
  pencil: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
};

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Category colour square with its icon, so colour is never the only signal. */
export function CatTile({ cat }: { cat: Pick<Category, "color" | "icon"> }) {
  return (
    <span className="tile" style={{ background: cat.color }}>
      <Icon d={cat.icon} />
    </span>
  );
}

const STATUS_BG: Record<Mood, string> = {
  content: "var(--mint)",
  curious: "var(--mint)",
  needy: "var(--amber)",
  playful: "var(--mint)",
  worried: "var(--coral)",
};

/** Papi's head and shoulders in a coloured circle. */
export function PapiBust({ mood, size = 76, bg, alt = "" }: { mood: Mood; size?: number; bg?: string; alt?: string }) {
  return (
    <span className="bust" style={{ width: size, height: size, background: bg ?? STATUS_BG[mood] }}>
      <Image src={`/papi/papi-${mood}.svg`} alt={alt} width={size} height={size} unoptimized priority />
    </span>
  );
}
