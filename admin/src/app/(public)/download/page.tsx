"use client";

import { useEffect, useState } from "react";

export default function DownloadPage() {
  const [info, setInfo] = useState<{
    version: string;
    downloadUrl: string | null;
    releaseNotes: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/v1/download")
      .then((r) => r.json())
      .then(setInfo);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7f7] px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#0f3d3e]">E26 Insurance Desk</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Download for Windows
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Install on your shop computer. Internet is needed once for license activation;
          daily work is offline.
        </p>

        {!info ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : info.downloadUrl ? (
          <div className="mt-6">
            <p className="mb-3 text-sm text-slate-600">
              Version <strong>{info.version}</strong>
            </p>
            <a
              href={info.downloadUrl}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#0f3d3e] px-4 py-3 text-sm font-medium text-white hover:bg-[#1a5c5e]"
            >
              Download ShopDesk Setup (.exe)
            </a>
            {info.releaseNotes ? (
              <p className="mt-4 text-sm text-slate-600">{info.releaseNotes}</p>
            ) : null}
            <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Download and run the installer</li>
              <li>Open ShopDesk from Start menu</li>
              <li>Enter the license key from E26</li>
              <li>Work offline after activation</li>
            </ol>
          </div>
        ) : (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Installer link not set yet. Contact E26 support.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          <a href="/admin/login" className="underline">
            E26 staff login
          </a>
        </p>
      </div>
    </div>
  );
}
