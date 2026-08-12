"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, PageHeader, Panel } from "@/components/ui";
import { downloadClientSheet } from "@/lib/clientSheet";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/utils";

export default function ClientsPage() {
  const { data, ready } = useStore();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rangeInit, setRangeInit] = useState(false);
  const today = todayISO();

  // Show all clients by default (not only today’s renewal window)
  useEffect(() => {
    if (!ready || rangeInit) return;
    const dates = data.policies
      .map((p) => p.expiryDate || p.date)
      .filter(Boolean)
      .sort();
    if (dates.length) {
      setFrom(dates[0]);
      const latest = dates[dates.length - 1];
      setTo(latest > today ? latest : today);
    } else {
      setFrom("");
      setTo("");
    }
    setRangeInit(true);
  }, [ready, data.policies, rangeInit, today]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.policies
      .filter((p) => {
        const renew = p.expiryDate || p.date;
        // Empty from/to = show all
        if (from && renew < from) return false;
        if (to && renew > to) return false;
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

  async function download() {
    await downloadClientSheet({
      title: from && to ? `RENEWAL ${from} to ${to}` : "CLIENTS / RENEWAL SHEET",
      policies: rows,
      date: to || from || today,
    });
  }

  function showAll() {
    const dates = data.policies
      .map((p) => p.expiryDate || p.date)
      .filter(Boolean)
      .sort();
    if (!dates.length) {
      setFrom("");
      setTo("");
      return;
    }
    setFrom(dates[0]);
    const latest = dates[dates.length - 1];
    setTo(latest > today ? latest : today);
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => void download()}
            >
              Download sheet PDF
            </Button>
          </div>
        }
      />

      <Panel className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Renewal from">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Renewal to">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Search">
          <Input
            placeholder="Reg no, owner, phone, company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
      </Panel>

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
                <th className="px-2 py-2 font-medium">Ins Owner</th>
                <th className="px-2 py-2 font-medium">CONTACT N</th>
                <th className="px-2 py-2 font-medium">Description</th>
                <th className="px-2 py-2 font-medium">RENEWAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
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
                  <td className="px-2 py-2">{p.clientName || "—"}</td>
                  <td className="px-2 py-2">{p.phone || p.contact || "—"}</td>
                  <td className="px-2 py-2">{p.description || "—"}</td>
                  <td className="px-2 py-2">{p.expiryDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
