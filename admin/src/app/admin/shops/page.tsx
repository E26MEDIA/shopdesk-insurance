"use client";

import { AdminShell } from "@/components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Shop = {
  id: string;
  shopCode: string;
  name: string;
  ownerName: string;
  phone?: string;
  status: string;
  _count: { licenses: number; devices: number };
};

export default function ShopsPage() {
  const [items, setItems] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
    state: "",
  });

  async function load() {
    const res = await fetch(`/api/admin/shops?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setItems(data.items || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createShop(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ name: "", ownerName: "", phone: "", email: "", city: "", state: "" });
    void load();
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Shops</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          Create Shop
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-md"
          placeholder="Search shop, owner, phone, code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Search
        </button>
      </div>

      {showForm ? (
        <form onSubmit={createShop} className="card mb-6 grid gap-3 md:grid-cols-2">
          <input className="input" placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input" placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className="btn btn-primary">Save Shop</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Shop</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Licenses</th>
              <th>Devices</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.shopCode}</td>
                <td>
                  <Link href={`/admin/shops/${s.id}`} className="text-[#0f3d3e] underline-offset-2 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td>{s.ownerName}</td>
                <td>{s.status}</td>
                <td>{s._count.licenses}</td>
                <td>{s._count.devices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
