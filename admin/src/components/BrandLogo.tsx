import { siteConfig } from "@/lib/site-config";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
};

const sizes = {
  sm: { box: "h-8 w-8 text-[10px]", title: "text-sm", subtitle: "text-[10px]" },
  md: { box: "h-9 w-9 text-xs", title: "text-sm", subtitle: "text-xs" },
  lg: { box: "h-11 w-11 text-sm", title: "text-base", subtitle: "text-xs" },
};

export function BrandLogo({
  size = "md",
  showText = true,
  className = "",
}: BrandLogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-[#0f3d3e] font-bold text-white ${s.box}`}
        aria-hidden
      >
        {siteConfig.brand}
      </span>
      {showText ? (
        <div>
          <p className={`font-semibold text-slate-900 ${s.title}`}>
            {siteConfig.name}
          </p>
          <p className={`text-slate-500 ${s.subtitle}`}>by {siteConfig.brand}</p>
        </div>
      ) : null}
    </div>
  );
}
