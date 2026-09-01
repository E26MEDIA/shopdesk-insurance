import { siteConfig } from "@/lib/site-config";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/download", label: "Software" },
  { href: "/#contact", label: "Request Software" },
  { href: "/admin/login", label: "Staff Login" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {siteConfig.brand} / {siteConfig.name}
            </p>
            <p className="mt-1 text-sm text-slate-600">{siteConfig.tagline}</p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-slate-600 transition hover:text-[#0f3d3e]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
          Copyright © {siteConfig.brand}
        </p>
      </div>
    </footer>
  );
}
