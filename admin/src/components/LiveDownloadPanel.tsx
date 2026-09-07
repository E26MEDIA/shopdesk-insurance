"use client";

import { InstallerDownloadButton } from "@/components/InstallerDownloadButton";
import { useLiveDownload } from "@/lib/use-live-download";

const buttonClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-[#0f3d3e] px-4 py-3 text-sm font-medium text-white hover:bg-[#1a5c5e]";

export function LiveDownloadPanel() {
  const { status, version, href, releaseNotes, fileName } = useLiveDownload();

  if (status === "loading") {
    return <p className="mt-6 text-sm text-slate-500">Checking the latest installer…</p>;
  }

  if (status === "error" || !href) {
    return (
      <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Installer link not set yet. Contact E26 support.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm text-slate-600">
        Version <strong>{version}</strong>
      </p>
      <InstallerDownloadButton href={href} fileName={fileName} className={buttonClass}>
        Download ShopDesk Setup (.zip)
      </InstallerDownloadButton>
      {releaseNotes ? (
        <p className="mt-4 text-sm text-slate-600">{releaseNotes}</p>
      ) : null}
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-slate-600">
        <li>Download the zip and extract it</li>
        <li>Run the installer</li>
        <li>
          If Windows says it protected your PC, click <strong>More info</strong> then{" "}
          <strong>Run anyway</strong>
        </li>
        <li>Open Insurance Desk from the desktop or Start menu</li>
        <li>Enter the license key from E26</li>
        <li>Work offline after activation</li>
      </ol>
    </div>
  );
}
