export function InstallerDownloadButton({
  href,
  fileName,
  children,
  className,
}: {
  href: string;
  fileName: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <a href={href} className={className}>
        {children}
      </a>
      <p className="mt-3 text-xs text-slate-500">
        Saves <strong>{fileName}</strong> to your Downloads folder. If Chrome
        says virus detected, open <strong>chrome://downloads</strong> and click{" "}
        <strong>Keep</strong> — this is unsigned new software from E26, not a
        random file.
      </p>
    </div>
  );
}
