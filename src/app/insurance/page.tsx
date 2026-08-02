"use client";

import Link from "next/link";
import { Button, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { policyProfit } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function InsuranceListPage() {
  const { data, ready, confirmPolicy } = useStore();
  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Insurance"
        subtitle="Save → Confirm. You can Edit anytime after confirm too."
        action={
          <Link href="/insurance/new">
            <Button>New insurance</Button>
          </Link>
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
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Received</th>
                <th className="px-3 py-2 font-medium">Profit</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.policies.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
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
