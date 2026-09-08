"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { openSharedDataFolder } from "@/lib/persist";
import { useSoftwareUpdate } from "@/components/UpdatePopup";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/insurance", label: "Insurance" },
  { href: "/puc", label: "PUC" },
  { href: "/reports", label: "Reports" },
  { href: "/masters", label: "Admin" },
];

export function AppNav() {
  const pathname = usePathname();
  const { offlineDesktop } = useStore();
  const { update, openModal, currentVersion } = useSoftwareUpdate();

  return (
    <header className="no-print border-b border-slate-200 bg-[#0f3d3e] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-xs font-bold text-white">
            E26
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">Insurance Desk</p>
            <p className="text-xs text-teal-100/80">
              by E26
              {offlineDesktop ? " · Offline desktop" : ""}
              {currentVersion ? ` · v${currentVersion}` : ""}
            </p>
          </div>
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
          {update?.available ? (
            <button
              type="button"
              className="ml-1 rounded-md bg-amber-300 px-3 py-1.5 text-xs font-semibold text-[#0f3d3e] hover:bg-amber-200"
              onClick={openModal}
            >
              Update
            </button>
          ) : null}
          {offlineDesktop ? (
            <button
              type="button"
              className="ml-1 rounded-md px-3 py-1.5 text-xs text-teal-50 hover:bg-white/10"
              onClick={() => void openSharedDataFolder()}
            >
              Data folder
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
