"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/insurance", label: "Insurance" },
  { href: "/reports", label: "Reports" },
  { href: "/masters", label: "Admin" },
];

export function AppNav() {
  const pathname = usePathname();
  const { offlineDesktop } = useStore();

  return (
    <header className="border-b border-slate-200 bg-[#0f3d3e] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">ShopDesk</p>
          <p className="text-xs text-teal-100/80">
            Insurance + PUC
            {offlineDesktop ? " · Offline desktop" : ""}
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-white text-[#0f3d3e]"
                    : "text-teal-50 hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {offlineDesktop ? (
            <button
              type="button"
              className="ml-1 rounded-md px-3 py-1.5 text-xs text-teal-50 hover:bg-white/10"
              onClick={() => void window.shopdesk?.openDataFolder()}
            >
              Data folder
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
