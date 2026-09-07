"use client";

import { useEffect, useState } from "react";
import { getDownloadConfig } from "@/lib/site-config";
import { toCorsInstallerUrl, toDirectDownloadUrl, isZipInstallerUrl } from "@/lib/download-url";
import { InstallerDownloadButton } from "@/components/InstallerDownloadButton";
import { Section, SectionHeader } from "./Section";

type DownloadInfo = {
  version: string;
  downloadUrl: string | null;
};

export function DownloadSection() {
  const staticConfig = getDownloadConfig();
  const [remote, setRemote] = useState<DownloadInfo | null>(null);

  useEffect(() => {
    void fetch("/api/v1/download", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: DownloadInfo) => setRemote(data))
      .catch(() => setRemote(null));
  }, []);

  const incoming = remote?.downloadUrl || staticConfig.url || "";
  const downloadUrl =
    (isZipInstallerUrl(incoming)
      ? toDirectDownloadUrl(incoming)
      : toCorsInstallerUrl(incoming)) || "";
  const version = remote?.version || staticConfig.version;
  const isAvailable = Boolean(downloadUrl);

  return (
    <Section id="download">
      <SectionHeader
        title="Download Insurance Desk"
        subtitle="Download the Insurance Desk desktop application provided for your account."
      />

      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#0f3d3e]">Insurance Desk</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">
          Desktop Application
        </h3>
        <p className="mt-1 text-sm text-slate-600">Windows Application</p>

        <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">
            Version: <span className="font-medium text-slate-900">{version}</span>
          </p>
        </div>

        {isAvailable ? (
          <InstallerDownloadButton
            href={downloadUrl}
            fileName={`ShopDesk-Setup-${version}.exe`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#0f3d3e] px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-[#0f3d3e]/10 hover:bg-[#1a5c5e]"
          >
            Download ShopDesk Setup (.zip)
          </InstallerDownloadButton>
        ) : (
          <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            Download will be available after setup.
          </p>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          Please install the software only on a Windows computer.
        </p>
      </div>
    </Section>
  );
}
