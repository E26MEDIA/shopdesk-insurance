"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "./ui";

/**
 * Keeps a trailing decimal while typing (so 4.5% can be entered)
 * and stores the numeric value.
 */
export function DecimalInput({
  value,
  onValue,
  maxDecimals = 2,
  ...rest
}: {
  value: number;
  onValue: (next: number) => void;
  maxDecimals?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState<string | null>(null);
  const shown = text !== null ? text : value ? String(value) : "";

  return (
    <Input
      {...rest}
      inputMode="decimal"
      className={`no-spin ${rest.className || ""}`}
      value={shown}
      onFocus={(event) => {
        setText(value ? String(value) : "");
        rest.onFocus?.(event);
      }}
      onBlur={(event) => {
        setText(null);
        rest.onBlur?.(event);
      }}
      onChange={(event) => {
        let cleaned = event.target.value.replace(/[^\d.]/g, "");
        const dot = cleaned.indexOf(".");
        if (dot >= 0) {
          const whole = cleaned.slice(0, dot);
          const fraction = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, maxDecimals);
          cleaned = `${whole}.${fraction}`;
        }
        setText(cleaned);
        if (cleaned === "" || cleaned === ".") {
          onValue(0);
          return;
        }
        const num = Number(cleaned);
        if (Number.isFinite(num)) onValue(num);
      }}
    />
  );
}
