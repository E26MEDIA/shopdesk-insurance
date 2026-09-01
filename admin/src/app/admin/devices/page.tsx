"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

export default function DevicesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  async function load() {
    const res = await fetch("/api/admin/devices");
    const data = await res.json();
    setItems(data.items || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function deactivate(id: string) {
    if (!confirm("Deactivate this device?")) return;
    await fetch(`/api/admin/devices/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate" }),
    });
    void load();
  }

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-semibold">Devices</h1>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Device</th>
              <th>Shop</th>
              <th>License</th>
              <th>OS</th>
              <th>Last validated</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={String(d.id)}>
                <td>{String(d.deviceName || d.id)}</td>
                <td>{String((d.shop as { name: string })?.name || "")}</td>
                <td>{String((d.license as { licenseDisplayId: string })?.licenseDisplayId || "")}</td>
                <td>{String(d.operatingSystem || "—")}</td>
                <td>{d.lastValidatedAt ? new Date(String(d.lastValidatedAt)).toLocaleString() : "—"}</td>
                <td>{String(d.status)}</td>
                <td>
                  {d.status === "ACTIVE" ? (
                    <button type="button" className="text-red-700" onClick={() => void deactivate(String(d.id))}>
                      Deactivate
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
