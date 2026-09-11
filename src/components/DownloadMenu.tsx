"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export function DownloadMenu({
  items,
  label = "Download",
}: {
  items: { label: string; onClick: () => void }[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label}
        <span className="ml-1 text-[10px]" aria-hidden>
          ▾
        </span>
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 min-w-[12rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
