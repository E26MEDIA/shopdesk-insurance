"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import { requireOfficeAdminPin } from "@/lib/persist";
import { useStore } from "@/lib/store";
import { policyProfit } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function InsuranceListPage() {
  const { data, ready, confirmPolicy, deletePolicies } = useStore();
  const [selected, setSelected] = useState<string[]>([]);

  const allIds = useMemo(() => data.policies.map((p) => p.id), [data.policies]);
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

  async function deleteSelected() {
    if (!selected.length) return;
    if (!(await requireOfficeAdminPin("delete insurance entries"))) return;
    const label =
      selected.length === 1
        ? "Delete this insurance entry?"
        : `Delete ${selected.length} insurance entries?`;
    if (!confirm(label)) return;
    deletePolicies(selected);
    setSelected([]);
  }

  return (
    <div>
      <PageHeader
        title="Insurance"
        subtitle="Save → Confirm. You can Edit anytime after confirm too. Tick rows to delete from this list."
        action={
          <div className="flex flex-wrap gap-2">
            {selected.length ? (
              <Button type="button" variant="danger" onClick={() => void deleteSelected()}>
                Delete selected ({selected.length})
              </Button>
            ) : null}
            <Link href="/insurance/new">
              <Button>New insurance</Button>
            </Link>
          </div>
        }
      />

      {data.policies.length === 0 ? (
        <p className="text-sm text-slate-600">
          No insurance entries yet.{" "}
          <Link href="/insurance/new" className="text-[#0f3d3e] underline">
            Create one
          </Link>
        </p>
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
                <th className="px-3 py-2 font-medium">Points</th>
                <th className="px-3 py-2 font-medium">Profit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.policies.map((p) => (
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
                  <td className="px-3 py-2">{p.points || "—"}</td>
                  <td className="px-3 py-2">{formatINR(policyProfit(p))}</td>
                  <td className="px-3 py-2">
                    {p.confirmed ? (
                      <span className="font-medium text-emerald-700">
                        Confirmed
                      </span>
                    ) : (
                      <span className="text-amber-700">Pending confirm</span>
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
                      {!p.confirmed ? (
                        <button
                          type="button"
                          className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                          onClick={() => confirmPolicy(p.id)}
                        >
                          Confirm
                        </button>
                      ) : null}
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
