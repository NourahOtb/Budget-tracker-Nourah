import { fmt } from "@/lib/money";

/** Warns when category limits exceed the monthly total, or shows what isn't assigned. */
export function AllocationMessage({ total, allocated }: { total: number; allocated: number }) {
  const diff = allocated - total;
  const text =
    diff === 0
      ? "Every dinar of the monthly total has a category."
      : diff > 0
        ? `Your category budgets add up to ${fmt(diff)} KWD more than your monthly total. Lower a category or raise the total.`
        : `${fmt(-diff)} KWD isn’t assigned to a category yet.`;
  return (
    <p role="status" className={diff > 0 ? "alloc-msg warn" : "alloc-msg"}>
      {text}
    </p>
  );
}
