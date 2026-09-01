"use client";

import { useEffect, useState } from "react";
import { getDownloadConfig } from "@/lib/site-config";
import { ButtonLink } from "./Button";
import { Section, SectionHeader } from "./Section";

type DownloadInfo = {
  version: string;
  downloadUrl: string | null;
};

export function DownloadSection() {
  const staticConfig = getDownloadConfig();
  const [remote, setRemote] = useState<DownloadInfo | null>(null);

  useEffect(() => {
    if (staticConfig.url || !staticConfig.apiUrl) return;

    void fetch(staticConfig.apiUrl)
      .then((r) => r.json())
      .then((data: DownloadInfo) => setRemote(data))
      .catch(() => setRemote(null));
  }, [staticConfig.url, staticConfig.apiUrl]);

  const downloadUrl = staticConfig.url || remote?.downloadUrl || "";
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
          <ButtonLink
            href={downloadUrl}
            className="mt-6 w-full"
            download
          >
            Download .EXE
          </ButtonLink>
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
