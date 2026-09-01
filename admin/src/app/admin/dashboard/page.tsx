"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

type DashboardData = {
  cards: Record<string, number>;
  recent: {
    shops: { id: string; name: string; shopCode: string; createdAt: string }[];
    licenses: {
      id: string;
      licenseDisplayId: string;
      edition: string;
      shop: { name: string };
      product: { name: string };
    }[];
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    void fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      {!data ? (
        <p className="text-sm text-slate-600">Loading dashboard…</p>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total Shops", data.cards.totalShops],
              ["Active Shops", data.cards.activeShops],
              ["Active Licenses", data.cards.activeLicenses],
              ["Expired Licenses", data.cards.expiredLicenses],
              ["Suspended Licenses", data.cards.suspendedLicenses],
              ["Active Devices", data.cards.activeDevices],
              ["Available Device Slots", data.cards.availableDeviceSlots],
              ["Expiring Soon", data.cards.licensesExpiringSoon],
            ].map(([label, value]) => (
              <div key={String(label)} className="card">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="mb-3 font-semibold">Recent Shops</h2>
              <ul className="space-y-2 text-sm">
                {data.recent.shops.map((s) => (
                  <li key={s.id} className="flex justify-between border-b border-slate-100 py-2">
                    <span>{s.name}</span>
                    <span className="text-slate-500">{s.shopCode}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="mb-3 font-semibold">Recent Licenses</h2>
              <ul className="space-y-2 text-sm">
                {data.recent.licenses.map((l) => (
                  <li key={l.id} className="flex justify-between border-b border-slate-100 py-2">
                    <span>
                      {l.shop.name} · {l.edition}
                    </span>
                    <span className="text-slate-500">{l.licenseDisplayId}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </AdminShell>
  );
}
