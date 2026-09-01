"use client";

import { AdminShell } from "@/components/AdminShell";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const [shop, setShop] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetch(`/api/admin/shops/${params.id}`)
      .then((r) => r.json())
      .then((d) => setShop(d.shop));
  }, [params.id]);

  if (!shop) {
    return (
      <AdminShell>
        <p>Loading…</p>
      </AdminShell>
    );
  }

  const licenses = (shop.licenses as Array<Record<string, unknown>>) || [];
  const devices = (shop.devices as Array<Record<string, unknown>>) || [];

  return (
    <AdminShell>
      <h1 className="mb-2 text-2xl font-semibold">{String(shop.name)}</h1>
      <p className="mb-6 text-sm text-slate-600">
        {String(shop.shopCode)} · {String(shop.ownerName)} · {String(shop.status)}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Licenses</h2>
          <ul className="space-y-2 text-sm">
            {licenses.map((l) => (
              <li key={String(l.id)} className="border-b border-slate-100 py-2">
                {String(l.licenseDisplayId)} · {String(l.edition)} · {String(l.status)}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Devices</h2>
          <ul className="space-y-2 text-sm">
            {devices.map((d) => (
              <li key={String(d.id)} className="flex justify-between border-b border-slate-100 py-2">
                <span>{String(d.deviceName || d.id)}</span>
                <span>{String(d.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
