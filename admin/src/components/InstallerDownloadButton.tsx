"use client";

import { useState } from "react";
import { isPlausibleInstallerSize, isZipInstallerUrl } from "@/lib/download-url";
import { createStoredZip } from "@/lib/zip-store";

type Status = "idle" | "downloading" | "packing" | "done" | "error";

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function zipName(fileName: string) {
  return fileName.replace(/\.exe$/i, "") + ".zip";
}

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
  const nativeZip = isZipInstallerUrl(href);
  const [status, setStatus] = useState<Status>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");

  async function download() {
    if (status === "downloading" || status === "packing") return;
    setStatus("downloading");
    setPercent(0);
    setError("");

    try {
      const response = await fetch(href, { mode: "cors", cache: "no-store" });
      if (!response.ok) throw new Error("Download failed");

      const total = Number(response.headers.get("content-length")) || 0;
      const body = response.body;
      const chunks: Uint8Array[] = [];
      let received = 0;

      if (!body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        chunks.push(bytes);
        received = bytes.length;
      } else {
        const reader = body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(value.slice());
          received += value.length;
          if (total > 0) {
            setPercent(Math.min(99, Math.round((received / total) * 100)));
          }
        }
      }

      if (!isPlausibleInstallerSize(received)) {
        throw new Error("File too small");
      }

      setStatus("packing");
      const zip = createStoredZip(fileName, chunks);
      saveBlob(zip, zipName(fileName));
      setPercent(100);
      setStatus("done");
    } catch {
      setStatus("error");
      setError(
        "Could not prepare the installer. Upload ShopDesk-Setup-0.1.5.zip to Dropbox and paste that share link in Admin → Software.",
      );
    }
  }

  if (nativeZip) {
    return (
      <div>
        <a href={href} className={className}>
          {children}
        </a>
        <p className="mt-3 text-xs text-slate-500">
          Saves a <strong>.zip</strong>. Extract it, then run{" "}
          <strong>{fileName.replace(/\.zip$/i, "")}</strong>.
        </p>
      </div>
    );
  }

  const label =
    status === "downloading"
      ? `Downloading… ${percent}%`
      : status === "packing"
        ? "Preparing zip…"
        : status === "done"
          ? "Download started"
          : children;

  return (
    <div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={status === "downloading" || status === "packing"}
        className={`${className} cursor-pointer disabled:cursor-wait disabled:opacity-80`}
      >
        {label}
      </button>
      <p className="mt-3 text-xs text-slate-500">
        Chrome blocks the raw .exe. Prefer uploading a <strong>.zip</strong> to
        Dropbox and pasting that link in Admin → Software.
      </p>
      {status === "done" ? (
        <p className="mt-2 text-sm text-slate-600">
          Saved to your Downloads folder. Extract it, then run the .exe.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
