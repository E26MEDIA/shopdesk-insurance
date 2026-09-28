"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui";

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  required = false,
  strict = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** Only an existing option can be saved. */
  strict?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rejectNote, setRejectNote] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const display = open ? query : value;

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
        if (!rootRef.current?.contains(e.target as Node)) {
        if (strict) commitStrict();
        else {
          setOpen(false);
          onChange(query.trim());
        }
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onChange, query, strict, options, value]);

  const filtered = useMemo(() => {
    const q = display.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.label.toLowerCase().includes(q));
  }, [options, display]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector<HTMLElement>("[data-active='true']");
    item?.scrollIntoView({ block: "nearest" });
  }, [active, open, filtered]);

  function pick(label: string) {
    setRejectNote("");
    setQuery(label);
    onChange(label);
    setOpen(false);
  }

  function focusNeighbor(from: HTMLElement, direction: 1 | -1) {
    const fields = [...document.querySelectorAll<HTMLElement>("input, select, textarea, button, a[href]")].filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex >= 0,
    );
    const index = fields.indexOf(from);
    const next = fields[index + direction];
    setOpen(false);
    next?.focus();
    next?.scrollIntoView({ block: "center" });
  }

  function commitStrict(typedRaw?: string) {
    const typed = (typedRaw !== undefined ? typedRaw : open ? query : value).trim();
    const match = options.find((item) => item.label.toLowerCase() === typed.toLowerCase());
    if (match) {
      pick(match.label);
      return;
    }
    if (typed) {
      setRejectNote(`“${typed}” is not in the list. Choose a name from the dropdown.`);
    } else {
      setRejectNote("");
    }
    const kept = options.find((item) => item.label.toLowerCase() === value.trim().toLowerCase());
    setQuery(kept?.label || "");
    onChange(kept?.label || "");
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef} data-arrow-menu={open ? "open" : "closed"}>
      <Input
        required={required}
        value={display}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setQuery(value);
        }}
        onBlur={() => {
          if (!open) return;
          if (strict) commitStrict(query);
          else {
            onChange(query.trim());
            setOpen(false);
          }
        }}
        onClick={() => {
          setQuery(value);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open) {
            e.preventDefault();
            e.stopPropagation();
            const count = filtered.length;
            const direction: 1 | -1 = e.key === "ArrowDown" ? 1 : -1;
            const leave = () => {
              if (strict) commitStrict(query);
              else {
                onChange(query.trim());
                setOpen(false);
              }
              focusNeighbor(e.currentTarget, direction);
            };
            if (!count || (direction > 0 && active >= count - 1) || (direction < 0 && active <= 0)) {
              leave();
              return;
            }
            setActive((index) => index + direction);
            return;
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            e.stopPropagation();
            if (filtered[active]) {
              pick(filtered[active].label);
              return;
            }
            if (strict) commitStrict();
            else if (filtered[0]) pick(filtered[0].label);
            else {
              onChange(query.trim());
              setOpen(false);
            }
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul ref={listRef} className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length ? (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-active={filtered[active]?.id === item.id ? "true" : "false"}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    filtered[active]?.id === item.id
                      ? "bg-[#0f3d3e] text-white"
                      : item.label === value
                        ? "bg-teal-50 text-[#0f3d3e]"
                        : "text-slate-800"
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
              {strict
                ? "No match. Choose one from the list."
                : `No match. Press Enter to keep “${display.trim() || "blank"}”.`}
            </li>
          )}
        </ul>
      ) : null}
      {rejectNote ? <p className="mt-1 text-xs font-medium text-red-700">{rejectNote}</p> : null}
    </div>
  );
}
