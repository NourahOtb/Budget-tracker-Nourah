"use client";

import { CAT } from "@/lib/categories";
import { fmt } from "@/lib/money";
import type { Spending } from "@/lib/types";
import { CatTile, ICONS, Icon } from "./ui";

export function SpendingRow({
  t,
  sub,
  onEdit,
  onRemove,
}: {
  t: Spending;
  /** Second line: when it happened, or its category. */
  sub: string;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const body = (
    <>
      <CatTile cat={t.cat} />
      <span className="row-text">
        <span className="row-name">
          {t.name}
          {t.photo && (
            <span className="row-photo" title="Has a photo">
              <Icon d={ICONS.camera} size={15} />
              <span className="sr-only">, has a photo</span>
            </span>
          )}
        </span>
        <span className="row-sub">{sub}</span>
      </span>
      <span className="row-amount">{fmt(t.fils)}</span>
    </>
  );
  return (
    <li className="row">
      {onEdit ? (
        <button type="button" className="row-main" onClick={onEdit} aria-label={`Edit ${t.name}, ${CAT[t.cat].name}, ${fmt(t.fils)} KWD, ${sub}${t.photo ? ", has a photo" : ""}`}>
          {body}
        </button>
      ) : (
        <div className="row-main">{body}</div>
      )}
      {onRemove && (
        <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove ${t.name}`}>
          <Icon d={ICONS.trash} size={20} />
        </button>
      )}
    </li>
  );
}
