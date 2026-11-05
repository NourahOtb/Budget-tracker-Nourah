import { fmt } from "@/lib/money";

/**
 * Compares the category budgets with the monthly total. When they add up to
 * more, it says by how much and what to do; `onRaise` adds a one-tap fix.
 */
export function AllocationMessage({ total, allocated, onRaise }: { total: number; allocated: number; onRaise?: () => void }) {
  const diff = allocated - total;
  if (diff > 0) {
    return (
      <div role="status" className="alloc-warn">
        <p className="alloc-warn-title">Your categories add up to more than your budget</p>
        <p className="alloc-warn-text">
          Together they come to <strong className="num">{fmt(allocated)} KWD</strong>, which is{" "}
          <strong className="num">{fmt(diff)} KWD</strong> over your monthly budget of <span className="num">{fmt(total)} KWD</span>. Raise the
          monthly budget, or lower the amount for some categories.
        </p>
        {onRaise && (
          <button type="button" className="btn-ghost alloc-warn-btn" onClick={onRaise}>
            Raise budget to {fmt(allocated)} KWD
          </button>
        )}
      </div>
    );
  }
  return (
    <p role="status" className="alloc-msg">
      {diff === 0 ? "Every dinar of the monthly total has a category." : `${fmt(-diff)} KWD isn’t assigned to a category yet.`}
    </p>
  );
}
