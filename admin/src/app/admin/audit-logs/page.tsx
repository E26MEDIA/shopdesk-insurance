"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

export default function AuditLogsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void fetch("/api/admin/audit-logs")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-semibold">Audit Logs</h1>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Time</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={String(log.id)}>
                <td>{new Date(String(log.timestamp)).toLocaleString()}</td>
                <td>{String((log.admin as { name?: string })?.name || "System")}</td>
                <td>{String(log.action)}</td>
                <td>{String(log.entityType)} {log.entityId ? `· ${String(log.entityId)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
