type InstallerDownloadButtonProps = {
  href: string;
  fileName: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Start a cross-origin .exe download without navigating to Dropbox/Drive.
 * The hidden iframe receives the attachment response; the page stays put.
 */
export function InstallerDownloadButton({
  href,
  fileName,
  children,
  className,
}: InstallerDownloadButtonProps) {
  return (
    <>
      <iframe
        name="installer-download"
        title="Installer download"
        sandbox="allow-downloads"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden border-0 opacity-0"
        aria-hidden
      />
      <a
        href={href}
        download={fileName}
        target="installer-download"
        rel="noreferrer"
        className={className}
      >
        {children}
      </a>
    </>
  );
}
