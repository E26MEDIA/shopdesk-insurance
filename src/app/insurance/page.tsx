"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BalanceDue } from "@/components/BalanceDue";
import { Button, Field, Input, PageHeader, Panel } from "@/components/ui";
import { appAlert, appConfirm } from "@/lib/appDialog";
import { requireOfficeAdminPin } from "@/lib/persist";
import { useStore } from "@/lib/store";
import { customerBalanceDue, policyProfit, totalProfitWithExtra } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function InsuranceListPage() {
  const { data, ready, deletePolicies } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? data.policies.filter((p) => {
          return (
            p.regNo.toLowerCase().includes(s) ||
            p.clientName.toLowerCase().includes(s) ||
            (p.phone || "").toLowerCase().includes(s) ||
            (p.contact || "").toLowerCase().includes(s) ||
            (p.company || "").toLowerCase().includes(s) ||
            (p.portal || "").toLowerCase().includes(s) ||
            (p.variant || "").toLowerCase().includes(s) ||
            (p.vehicleMode || "").toLowerCase().includes(s) ||
            (p.description || "").toLowerCase().includes(s)
          );
        })
      : data.policies;
    return [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [data.policies, q]);

  const allIds = useMemo(() => rows.map((p) => p.id), [rows]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : allIds);
  }

  async function deleteIds(ids: string[]) {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      if (!(await requireOfficeAdminPin("delete insurance entries"))) return;
      const label =
        ids.length === 1
          ? "Delete this insurance entry? This cannot be undone."
          : `Delete ${ids.length} insurance entries? This cannot be undone.`;
      if (
        !(await appConfirm(label, {
          title: "Delete insurance",
          confirmLabel: ids.length === 1 ? "Delete" : `Delete ${ids.length}`,
          danger: true,
        }))
      ) {
        return;
      }
      await deletePolicies(ids);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
    } catch (error) {
      await appAlert(
        error instanceof Error ? error.message : "Could not delete insurance entries.",
        "Delete failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Insurance"
        subtitle="Save stores the insurance as confirmed. Open a row anytime to edit or add documents."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={busy || !selected.length}
              onClick={() => void deleteIds(selected)}
            >
              {busy ? "Deleting…" : `Delete selected${selected.length ? ` (${selected.length})` : ""}`}
            </Button>
            <Link href="/insurance/new">
              <Button>New insurance</Button>
            </Link>
          </div>
        }
      />

      {data.policies.length ? (
        <Panel className="mb-4">
          <Field label="Search">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, vehicle, phone, company, portal…"
            />
          </Field>
        </Panel>
      ) : null}

      {data.policies.length === 0 ? (
        <p className="text-sm text-slate-600">
          No insurance entries yet.{" "}
          <Link href="/insurance/new" className="text-[#0f3d3e] underline">
            Create one
          </Link>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-amber-800">No insurance entries match “{q.trim()}”.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="w-10 px-3 py-2 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Select all insurance entries"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Received</th>
                <th className="px-3 py-2 font-medium">Credit</th>
                <th className="px-3 py-2 font-medium">Ins Extra PO</th>
                <th className="px-3 py-2 font-medium">Est. profit</th>
                <th className="px-3 py-2 font-medium">Total profit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.clientName || p.regNo || p.date}`}
                      checked={selectedSet.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/insurance/${p.id}`}
                      className="font-medium text-[#0f3d3e] hover:underline"
                    >
                      {p.date}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.clientName || "—"}</td>
                  <td className="px-3 py-2">{p.regNo || "—"}</td>
                  <td className="px-3 py-2">{p.company || "—"}</td>
                  <td className="px-3 py-2">{formatINR(p.received)}</td>
                  <td className="px-3 py-2">
                    <BalanceDue amount={customerBalanceDue(p)} />
                  </td>
                  <td className="px-3 py-2">{formatINR(p.insExtraPo || 0)}</td>
                  <td className="px-3 py-2">{formatINR(policyProfit(p))}</td>
                  <td className="px-3 py-2">{formatINR(totalProfitWithExtra(p))}</td>
                  <td className="px-3 py-2">
                    {p.confirmed ? (
                      <span className="font-medium text-emerald-700">
                        Confirmed
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-700">Saved</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/insurance/${p.id}`}
                        className="text-xs text-[#0f3d3e] underline"
                      >
                        Open / Edit
                      </Link>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-700 underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void deleteIds([p.id])}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
