"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

type Shop = { id: string; name: string };
type Product = { id: string; name: string };

export default function LicensesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [createdKey, setCreatedKey] = useState("");
  const [form, setForm] = useState({
    shopId: "",
    productId: "",
    edition: "Professional",
    allowedDevices: 1,
    validityDays: 365,
    lifetime: false,
  });

  async function load() {
    const [licRes, shopRes, prodRes] = await Promise.all([
      fetch("/api/admin/licenses"),
      fetch("/api/admin/shops"),
      fetch("/api/admin/products"),
    ]);
    const licData = await licRes.json();
    const shopData = await shopRes.json();
    const prodData = await prodRes.json();
    setItems(licData.items || []);
    setShops(shopData.items || []);
    setProducts(prodData.products || []);
    if (!form.productId && prodData.products?.[0]) {
      setForm((f) => ({ ...f, productId: prodData.products[0].id }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createLicense(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.licenseKey) setCreatedKey(data.licenseKey);
    void load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-semibold">Licenses</h1>

      {createdKey ? (
        <div className="card mb-6 border-emerald-200 bg-emerald-50">
          <p className="font-medium text-emerald-900">License created — copy this key now:</p>
          <p className="mt-2 font-mono text-lg">{createdKey}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => setCreatedKey("")}>
            Dismiss
          </button>
        </div>
      ) : null}

      <form onSubmit={createLicense} className="card mb-6 grid gap-3 md:grid-cols-3">
        <select className="input" value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} required>
          <option value="">Select shop</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="input" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })}>
          <option>Basic</option>
          <option>Professional</option>
          <option>Business</option>
        </select>
        <select className="input" value={form.allowedDevices} onChange={(e) => setForm({ ...form, allowedDevices: Number(e.target.value) })}>
          {[1, 2, 3, 5].map((n) => (
            <option key={n} value={n}>{n} device{n > 1 ? "s" : ""}</option>
          ))}
        </select>
        <select
          className="input"
          value={form.lifetime ? "lifetime" : String(form.validityDays)}
          onChange={(e) => {
            if (e.target.value === "lifetime") setForm({ ...form, lifetime: true, validityDays: 0 });
            else setForm({ ...form, lifetime: false, validityDays: Number(e.target.value) });
          }}
        >
          <option value="365">1 year</option>
          <option value="730">2 years</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <button type="submit" className="btn btn-primary">Create License</button>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>License ID</th>
              <th>Shop</th>
              <th>Edition</th>
              <th>Devices</th>
              <th>Status</th>
              <th>Expiry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => {
              const devices = (l.devices as unknown[]) || [];
              const active = devices.filter((d) => (d as { status: string }).status === "ACTIVE").length;
              return (
                <tr key={String(l.id)}>
                  <td>{String(l.licenseDisplayId)}</td>
                  <td>{String((l.shop as { name: string })?.name || "")}</td>
                  <td>{String(l.edition)}</td>
                  <td>{active}/{String(l.allowedDevices)}</td>
                  <td>{String(l.status)}</td>
                  <td>{l.expiryDate ? new Date(String(l.expiryDate)).toLocaleDateString() : "Lifetime"}</td>
                  <td className="space-x-2">
                    {l.status !== "SUSPENDED" ? (
                      <button type="button" className="text-amber-700" onClick={() => void updateStatus(String(l.id), "SUSPENDED")}>Suspend</button>
                    ) : (
                      <button type="button" className="text-emerald-700" onClick={() => void updateStatus(String(l.id), "ACTIVE")}>Reactivate</button>
                    )}
                    <button type="button" className="text-red-700" onClick={() => void updateStatus(String(l.id), "REVOKED")}>Revoke</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
