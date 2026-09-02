"use client";

import { AdminShell } from "@/components/AdminShell";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ShopForm = {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address: string;
  notes: string;
  status: string;
};

export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const [shop, setShop] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<ShopForm>({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    address: "",
    notes: "",
    status: "ACTIVE",
  });

  async function load() {
    const res = await fetch(`/api/admin/shops/${params.id}`);
    const data = await res.json();
    if (data.shop) {
      setShop(data.shop);
      setForm({
        name: String(data.shop.name || ""),
        ownerName: String(data.shop.ownerName || ""),
        phone: String(data.shop.phone || ""),
        email: String(data.shop.email || ""),
        city: String(data.shop.city || ""),
        state: String(data.shop.state || ""),
        address: String(data.shop.address || ""),
        notes: String(data.shop.notes || ""),
        status: String(data.shop.status || "ACTIVE"),
      });
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function saveShop(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/shops/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(res.ok);
    setEditing(false);
    void load();
  }

  if (!shop) {
    return (
      <AdminShell>
        <p>Loading…</p>
      </AdminShell>
    );
  }

  const licenses = (shop.licenses as Array<Record<string, unknown>>) || [];
  const devices = (shop.devices as Array<Record<string, unknown>>) || [];
  const email = String(shop.email || "");

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/shops" className="text-sm text-[#0f3d3e] underline">
            ← Back to shops
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{String(shop.name)}</h1>
          <p className="text-sm text-slate-600">
            {String(shop.shopCode)} · {String(shop.ownerName)} · {String(shop.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {email ? (
            <a href={`mailto:${email}`} className="btn btn-secondary">
              Email client
            </a>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel edit" : "Edit shop"}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={saveShop} className="card mb-6 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="label">Shop name</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="label">Owner name</span>
            <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="label">Client email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="label">Phone</span>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="label">City</span>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="label">State</span>
            <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="label">Address</span>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="label">Notes</span>
            <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="label">Status</span>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary">Save changes</button>
          </div>
          {saved ? <p className="text-sm text-emerald-700 md:col-span-2">Shop updated.</p> : null}
        </form>
      ) : (
        <div className="card mb-6 grid gap-2 text-sm md:grid-cols-2">
          <p><span className="text-slate-500">Email:</span> {email || "—"}</p>
          <p><span className="text-slate-500">Phone:</span> {String(shop.phone || "—")}</p>
          <p><span className="text-slate-500">City:</span> {String(shop.city || "—")}</p>
          <p><span className="text-slate-500">State:</span> {String(shop.state || "—")}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Licenses</h2>
          <ul className="space-y-2 text-sm">
            {licenses.length === 0 ? (
              <li className="text-slate-500">No licenses yet.</li>
            ) : (
              licenses.map((l) => (
                <li key={String(l.id)} className="border-b border-slate-100 py-2">
                  {String(l.licenseDisplayId)} · {String(l.edition)} · {String(l.status)}
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Devices</h2>
          <ul className="space-y-2 text-sm">
            {devices.length === 0 ? (
              <li className="text-slate-500">No devices yet.</li>
            ) : (
              devices.map((d) => (
                <li key={String(d.id)} className="flex justify-between border-b border-slate-100 py-2">
                  <span>{String(d.deviceName || d.id)}</span>
                  <span>{String(d.status)}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
