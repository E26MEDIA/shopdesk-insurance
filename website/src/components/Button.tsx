import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-[#0f3d3e] text-white hover:bg-[#1a5c5e] shadow-sm shadow-[#0f3d3e]/10",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  ghost: "text-[#0f3d3e] hover:bg-teal-50",
};

const base =
  "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`${base} ${styles[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a {...props} className={`${base} ${styles[variant]} ${className}`} />
  );
}
