"use client";

import type { ReactNode } from "react";
import { Field, Input, Panel, Select } from "./ui";

export type DateRangePreset = "all" | "this_month" | "last_month" | "custom";

export function DateRangeBar({
  from,
  to,
  preset,
  onPreset,
  onFrom,
  onTo,
  fromLabel = "From",
  toLabel = "To",
  extra,
}: {
  from: string;
  to: string;
  preset: DateRangePreset;
  onPreset: (preset: DateRangePreset) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  extra?: ReactNode;
}) {
  function commitFrom(value: string) {
    if (!value) return;
    onFrom(value);
  }
  function commitTo(value: string) {
    if (!value) return;
    onTo(value);
  }

  return (
    <PanelLike extra={extra}>
      <Field label="Date range">
        <Select
          value={preset}
          onChange={(e) => onPreset(e.target.value as DateRangePreset)}
        >
          <option value="all">All dates</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom range</option>
        </Select>
      </Field>
      <Field label={fromLabel}>
        <Input
          type="date"
          value={from}
          onChange={(e) => commitFrom(e.target.value)}
          onInput={(e) => commitFrom((e.target as HTMLInputElement).value)}
          onBlur={(e) => commitFrom(e.target.value)}
        />
      </Field>
      <Field label={toLabel}>
        <Input
          type="date"
          value={to}
          onChange={(e) => commitTo(e.target.value)}
          onInput={(e) => commitTo((e.target as HTMLInputElement).value)}
          onBlur={(e) => commitTo(e.target.value)}
        />
      </Field>
    </PanelLike>
  );
}

function PanelLike({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Panel className="mb-6 grid max-w-3xl gap-3 sm:grid-cols-3">
      {children}
      {extra ? <div className="sm:col-span-3">{extra}</div> : null}
    </Panel>
  );
}
