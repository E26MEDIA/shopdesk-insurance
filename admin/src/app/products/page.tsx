"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

export default function ProductsPage() {
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void fetch("/api/admin/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }, []);

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-semibold">Products & Modules</h1>
      {products.map((p) => (
        <section key={String(p.id)} className="card mb-4">
          <h2 className="font-semibold">{String(p.name)}</h2>
          <p className="mb-3 text-sm text-slate-600">{String(p.description || "")}</p>
          <div className="flex flex-wrap gap-2">
            {((p.modules as Array<{ module: { name: string; moduleKey: string } }>) || []).map((pm) => (
              <span key={pm.module.moduleKey} className="badge badge-slate">
                {pm.module.name}
              </span>
            ))}
          </div>
        </section>
      ))}
    </AdminShell>
  );
}
