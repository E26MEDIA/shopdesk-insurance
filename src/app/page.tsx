"use client";

import Link from "next/link";
import { Button, PageHeader, Stat } from "@/components/ui";
import { useStore } from "@/lib/store";
import { policyProfit, totalProfitWithExtra } from "@/lib/types";
import { formatINR, todayISO } from "@/lib/utils";

export default function DashboardPage() {
  const { data, ready } = useStore();
  const today = todayISO();

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  const todayPolicies = data.policies.filter((p) => p.date === today);
  const todayInsurance = todayPolicies.reduce((s, p) => s + totalProfitWithExtra(p), 0);
  const todayEstimated = todayPolicies.reduce((s, p) => s + policyProfit(p), 0);
  const todayPuc = data.pucEntries
    .filter((p) => p.date === today)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const todayProfit = todayInsurance + todayPuc;

  const soon = data.policies
    .filter((p) => p.expiryDate)
    .map((p) => {
      const days = Math.ceil(
        (new Date(p.expiryDate).getTime() - Date.now()) / 86400000,
      );
      return { ...p, days };
    })
    .filter((p) => p.days >= 0 && p.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Today’s insurance, PUC income, and renewals"
        action={
          <div className="flex gap-2">
            <Link href="/insurance/new">
              <Button>New insurance</Button>
            </Link>
            <Link href="/puc">
              <Button variant="secondary">Edit PUC</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Insurance today" value={String(todayPolicies.length)} />
        <Stat label="Total profit today" value={formatINR(todayProfit)} hint="Insurance profit + PUC profit" />
        <Stat label="Portal profit today" value={formatINR(todayEstimated)} hint="Estimated, without Ins Extra PO" />
        <Stat label="PUC income today" value={formatINR(todayPuc)} />
        <Stat label="Total policies" value={String(data.policies.length)} />
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Renewals in next 30 days
        </h2>
        {soon.length === 0 ? (
          <p className="text-sm text-slate-600">No upcoming renewals.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Vehicle</th>
                  <th className="px-3 py-2 font-medium">Expiry</th>
                  <th className="px-3 py-2 font-medium">Days left</th>
                </tr>
              </thead>
              <tbody>
                {soon.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <Link
                        href={`/insurance/${p.id}`}
                        className="text-[#0f3d3e] underline-offset-2 hover:underline"
                      >
                        {p.clientName || "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{p.regNo || "—"}</td>
                    <td className="px-3 py-2">{p.expiryDate}</td>
                    <td className="px-3 py-2">{p.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
