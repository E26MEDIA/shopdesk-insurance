"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui";

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const display = open ? query : value;

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onChange(query.trim());
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onChange, query]);

  const filtered = useMemo(() => {
    const q = display.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.label.toLowerCase().includes(q));
  }, [options, display]);

  function pick(label: string) {
    setQuery(label);
    onChange(label);
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <Input
        required={required}
        value={display}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setQuery(value);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[0]) pick(filtered[0].label);
            else {
              onChange(query.trim());
              setOpen(false);
            }
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length ? (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    item.label === value ? "bg-teal-50 text-[#0f3d3e]" : "text-slate-800"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item.label)}
                >
                  {item.label}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-slate-500">
              No match. Press Enter to keep “{display.trim() || "blank"}”.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
