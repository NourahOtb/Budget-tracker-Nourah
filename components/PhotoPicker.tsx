"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ICONS, Icon } from "./ui";

/** A picked photo that hasn't been uploaded yet, with a local preview. */
export function usePickedPhoto() {
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const urlRef = useRef<string | null>(null);

  const setFile = useCallback((file: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = file ? URL.createObjectURL(file) : null;
    setPicked(file && urlRef.current ? { file, preview: urlRef.current } : null);
  }, []);

  // Free the preview when the form goes away.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return { file: picked?.file ?? null, preview: picked?.preview ?? null, setFile };
}

/**
 * Button that opens the camera or photo library. On phones the browser offers
 * both; `accept="image/*"` without `capture` keeps the library available.
 */
export function PhotoButton({ onPick, label, className = "icon-btn photo-btn" }: { onPick: (f: File) => void; label: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} aria-label={label}>
        <Icon d={ICONS.camera} />
        {className.includes("btn-ghost") && <span>{label}</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
