"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ButtonLink } from "./Button";

const links = [
  { href: "/#home", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#showcase", label: "UI/UX" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/download", label: "Download" },
  { href: "/#contact", label: "Contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="/#home" className="group">
          <BrandLogo />
        </a>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
          <ButtonLink href="#contact" className="ml-2">
            Request Insurance Desk
          </ButtonLink>
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <ButtonLink
              href="#contact"
              className="mt-2 w-full"
              onClick={() => setOpen(false)}
            >
              Request Insurance Desk
            </ButtonLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
