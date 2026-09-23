"use client";

import { useMemo, useState } from "react";
import { DecimalInput } from "@/components/DecimalInput";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { portalPoRows, type PortalPoRow } from "@/lib/ledger";
import { requireOfficeAdminPin } from "@/lib/persist";
import { useStore } from "@/lib/store";
import { formatINR, todayISO } from "@/lib/utils";

export function PortalPoBoard({ asOf, compact = false }: { asOf: string; compact?: boolean }) {
  const { data, addPortalReceipt, deletePortalReceipt } = useStore();
  const today = todayISO();
  const [portal, setPortal] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");

  const rows = useMemo(() => portalPoRows(data, asOf), [data, asOf]);
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const item of data.masters.portals || []) if (item.label.trim()) set.add(item.label.trim());
    for (const item of data.masters.companies || []) if (item.label.trim()) set.add(item.label.trim());
    for (const row of rows) set.add(row.name);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data.masters, rows]);

  const visible = compact ? rows.filter((row) => row.toCome || row.received || row.pending) : rows;
  const receipts = (data.portalReceipts || [])
    .filter((receipt) => !asOf || receipt.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date));

  function saveReceipt(event: React.FormEvent) {
    event.preventDefault();
    const name = portal.trim();
    if (!name || !amount) return;
    addPortalReceipt({
      date: date || today,
      portal: name,
      amount,
      notes,
    });
    setAmount(0);
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="text-base font-semibold text-slate-900">Portal PO</h2>
        <p className="mt-1 text-sm text-slate-600">
          To come is the estimated profit from the portal as of {asOf}. Example: Mint 50,000 to come, 10,000 received, 40,000 pending.
          Ins Extra PO is not included. A new portal or company shows up here as soon as it is added.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-2 py-2 font-medium">Portal / company</th>
                <th className="px-2 py-2 font-medium">Kind</th>
                <th className="px-2 py-2 font-medium">Companies</th>
                <th className="px-2 py-2 font-medium">To come</th>
                <th className="px-2 py-2 font-medium">Received</th>
                <th className="px-2 py-2 font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-600" colSpan={6}>
                    No portal payout yet. Save an insurance entry with a portal or company and it will appear here.
                  </td>
                </tr>
              ) : (
                visible.map((row: PortalPoRow) => (
                  <tr key={`${row.kind}-${row.name}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium">{row.name}</td>
                    <td className="px-2 py-2">{row.kind}</td>
                    <td className="px-2 py-2">{row.companies.join(", ") || "—"}</td>
                    <td className="px-2 py-2">{formatINR(row.toCome)}</td>
                    <td className="px-2 py-2">{formatINR(row.received)}</td>
                    <td className={`px-2 py-2 font-semibold ${row.pending > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                      {formatINR(row.pending)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">PO received from portal</h3>
        <form onSubmit={saveReceipt} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
            />
          </Field>
          <Field label="Portal or company">
            <Select value={portal} onChange={(event) => setPortal(event.target.value)} required>
              <option value="">Select</option>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount received">
            <DecimalInput value={amount} onValue={setAmount} maxDecimals={2} placeholder="e.g. 10000" required />
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Mint payout" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">Save received amount</Button>
          </div>
        </form>
        {receipts.length ? (
          <ul className="mt-4 space-y-2">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {receipt.portal} · {formatINR(receipt.amount)}
                  </p>
                  <p className="text-slate-600">
                    {receipt.date}
                    {receipt.notes ? ` · ${receipt.notes}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => {
                    void (async () => {
                      if (await requireOfficeAdminPin("delete a portal receipt")) deletePortalReceipt(receipt.id);
                    })();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Nothing received from a portal yet.</p>
        )}
      </Panel>
    </div>
  );
}
