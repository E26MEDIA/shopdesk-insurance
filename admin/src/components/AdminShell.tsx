"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shops", label: "Shops" },
  { href: "/licenses", label: "Licenses" },
  { href: "/devices", label: "Devices" },
  { href: "/products", label: "Products" },
  { href: "/software", label: "Download" },
  { href: "/audit-logs", label: "Audit Logs" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (!d.admin) router.replace("/login");
        else setAdmin(d.admin);
      });
  }, [router]);

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-200 bg-[#0f3d3e] text-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <p className="text-lg font-semibold">E26 Admin</p>
          <p className="text-xs text-teal-100/80">Insurance Desk Licensing</p>
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-4 lg:flex-col">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-white text-[#0f3d3e]" : "text-teal-50 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="font-medium">{admin.name}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
            Logout
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
