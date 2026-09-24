"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BalanceDue } from "@/components/BalanceDue";
import { DateRangeBar, type DateRangePreset } from "@/components/DateRangeBar";
import { DownloadMenu } from "@/components/DownloadMenu";
import { Button, Field, Input, PageHeader } from "@/components/ui";
import { downloadClientSheet } from "@/lib/clientSheet";
import { downloadClientSheetExcel } from "@/lib/excelDownload";
import { useStore } from "@/lib/store";
import { customerCredit } from "@/lib/types";
import { inDateRange, monthRange, todayISO } from "@/lib/utils";

function spanFromDates(dates: string[], today: string): { from: string; to: string } {
  if (!dates.length) return { from: "", to: "" };
  const latest = dates[dates.length - 1];
  return { from: dates[0], to: latest > today ? latest : today };
}

export default function ClientsPage() {
  const { data, ready } = useStore();
  const [q, setQ] = useState("");
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const today = todayISO();

  const allDates = useMemo(
    () =>
      data.policies
        .map((p) => p.expiryDate || p.date)
        .filter(Boolean)
        .sort(),
    [data.policies],
  );
  const dataRange = useMemo(() => spanFromDates(allDates, today), [allDates, today]);
  const from = preset === "all" ? dataRange.from : customFrom || dataRange.from;
  const to = preset === "all" ? dataRange.to : customTo || dataRange.to;

  function applyPreset(next: DateRangePreset) {
    setPreset(next);
    if (next === "all") {
      setCustomFrom(null);
      setCustomTo(null);
      return;
    }
    if (next === "today") {
      setCustomFrom(today);
      setCustomTo(today);
      return;
    }
    if (next === "this_month") {
      const range = monthRange(0);
      setCustomFrom(range.from);
      setCustomTo(range.to);
      return;
    }
    if (next === "last_month") {
      const range = monthRange(-1);
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.policies
      .filter((p) => {
        const renew = p.expiryDate || p.date;
        if (from && to && !inDateRange(renew, from, to)) return false;
        if (!s) return true;
        return (
          p.regNo.toLowerCase().includes(s) ||
          p.clientName.toLowerCase().includes(s) ||
          (p.phone || "").toLowerCase().includes(s) ||
          (p.company || "").toLowerCase().includes(s) ||
          (p.portal || "").toLowerCase().includes(s) ||
          (p.variant || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) =>
        (a.expiryDate || a.date).localeCompare(b.expiryDate || b.date),
      );
  }, [data.policies, from, to, q]);

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  function download() {
    downloadClientSheet({
      title: from && to ? `RENEWAL ${from} to ${to}` : "CLIENTS / RENEWAL SHEET",
      policies: rows,
    });
  }

  function downloadExcel() {
    downloadClientSheetExcel({
      title: from && to ? `RENEWAL ${from} to ${to}` : "CLIENTS / RENEWAL SHEET",
      policies: rows,
    });
  }

  function showAll() {
    applyPreset("all");
  }

  return (
    <div>
      <PageHeader
        title="Clients / Renewal sheet"
        subtitle="Filled from insurance entries — REG NO, MODEL, VARIANT, PORTAL, Company, Payments, Receipts…"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/insurance/new">
              <Button type="button">Add insurance</Button>
            </Link>
            <DownloadMenu
              items={[
                { label: "Download sheet PDF", onClick: download },
                { label: "Download Excel", onClick: () => void downloadExcel() },
              ]}
            />
          </div>
        }
      />

      <DateRangeBar
        from={from}
        to={to}
        preset={preset}
        fromLabel="Renewal from"
        toLabel="Renewal to"
        onPreset={applyPreset}
        onFrom={(value) => {
          if (!value) return;
          setPreset("custom");
          setCustomFrom(value);
          setCustomTo((prev) => {
            const currentTo = prev || dataRange.to;
            return value > currentTo ? value : currentTo;
          });
        }}
        onTo={(value) => {
          if (!value) return;
          setPreset("custom");
          setCustomTo(value);
          setCustomFrom((prev) => {
            const currentFrom = prev || dataRange.from;
            return value < currentFrom ? value : currentFrom;
          });
        }}
        extra={
          <Field label="Search">
            <Input
              placeholder="Reg no, owner, phone, company…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Field>
        }
      />

      {data.policies.length > 0 && rows.length === 0 ? (
        <p className="mb-4 text-sm text-amber-800">
          No clients in this renewal date range.{" "}
          <button type="button" className="underline" onClick={showAll}>
            Show all clients
          </button>
        </p>
      ) : null}

      {data.policies.length === 0 ? (
        <p className="text-sm text-slate-600">
          No clients yet.{" "}
          <Link href="/insurance/new" className="text-[#0f3d3e] underline">
            Add insurance
          </Link>{" "}
          — client details are saved with each policy.
        </p>
      ) : rows.length === 0 ? null : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2 font-medium">REG NO</th>
                <th className="px-2 py-2 font-medium">MODEL</th>
                <th className="px-2 py-2 font-medium">VARIANT</th>
                <th className="px-2 py-2 font-medium">PORTAL</th>
                <th className="px-2 py-2 font-medium">Company</th>
                <th className="px-2 py-2 font-medium">Payments</th>
                <th className="px-2 py-2 font-medium">Receipts</th>
                <th className="px-2 py-2 font-medium">Credit</th>
                <th className="px-2 py-2 font-medium">Ins Owner</th>
                <th className="px-2 py-2 font-medium">CONTACT N</th>
                <th className="px-2 py-2 font-medium">Description</th>
                <th className="px-2 py-2 font-medium">RENEWAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const due = customerCredit(p);
                return (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 ${due ? "bg-red-50/70" : ""}`}
                >
                  <td className="px-2 py-2">
                    <Link
                      href={`/insurance/${p.id}`}
                      className="font-medium text-[#0f3d3e] hover:underline"
                    >
                      {p.regNo || "—"}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{p.vehicleMode || "—"}</td>
                  <td className="px-2 py-2">{p.variant || "—"}</td>
                  <td className="px-2 py-2">{p.portal || "—"}</td>
                  <td className="px-2 py-2">{p.company || "—"}</td>
                  <td className="px-2 py-2">{p.payment || "—"}</td>
                  <td className="px-2 py-2">{p.received || "—"}</td>
                  <td className="px-2 py-2">
                    <BalanceDue amount={due} />
                  </td>
                  <td className="px-2 py-2">{p.clientName || "—"}</td>
                  <td className="px-2 py-2">{p.phone || p.contact || "—"}</td>
                  <td className="px-2 py-2">{p.description || "—"}</td>
                  <td className="px-2 py-2">{p.expiryDate || "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
