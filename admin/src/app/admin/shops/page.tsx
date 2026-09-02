"use client";

import { AdminShell } from "@/components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Shop = {
  id: string;
  shopCode: string;
  name: string;
  ownerName: string;
  email?: string;
  phone?: string;
  status: string;
  _count: { licenses: number; devices: number };
};

export default function ShopsPage() {
  const [items, setItems] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
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
    setError("");
    const res = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create shop. Check email format.");
      return;
    }
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
          <label className="block text-sm">
            <span className="label">Shop name *</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="label">Owner name *</span>
            <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="label">Client email *</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="client@email.com" />
          </label>
          <label className="block text-sm">
            <span className="label">Phone</span>
            <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="label">City</span>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="label">State</span>
            <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </label>
          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
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
              <th>Email</th>
              <th>Status</th>
              <th>Licenses</th>
              <th></th>
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
                <td>{s.email || "—"}</td>
                <td>{s.status}</td>
                <td>{s._count.licenses}</td>
                <td>
                  <Link href={`/admin/shops/${s.id}`} className="text-sm text-[#0f3d3e] underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
