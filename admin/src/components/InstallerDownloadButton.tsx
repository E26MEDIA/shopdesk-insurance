"use client";

import { useState } from "react";
import { isPlausibleInstallerSize } from "@/lib/download-url";

type InstallerDownloadButtonProps = {
  href: string;
  fileName: string;
  children: React.ReactNode;
  className?: string;
};

type Status = "idle" | "downloading" | "done" | "error";

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

export function InstallerDownloadButton({
  href,
  fileName,
  children,
  className,
}: InstallerDownloadButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");

  async function download() {
    if (status === "downloading") return;
    setStatus("downloading");
    setPercent(0);
    setError("");

    try {
      const response = await fetch(href, { mode: "cors", cache: "no-store" });
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const total = Number(response.headers.get("content-length")) || 0;
      const body = response.body;
      let blob: Blob;

      if (!body) {
        blob = await response.blob();
      } else {
        const reader = body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;
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
        blob = new Blob(chunks, { type: "application/octet-stream" });
      }

      if (!isPlausibleInstallerSize(blob.size)) {
        throw new Error("File too small");
      }

      saveBlob(blob, fileName);
      setPercent(100);
      setStatus("done");
    } catch {
      setStatus("error");
      setError(
        "Could not start the download on this page. Refresh and try again, or contact E26 support.",
      );
    }
  }

  const label =
    status === "downloading"
      ? `Downloading… ${percent}%`
      : status === "done"
        ? "Download started"
        : children;

  return (
    <div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={status === "downloading"}
        className={`${className} cursor-pointer disabled:cursor-wait disabled:opacity-80`}
      >
        {label}
      </button>
      {status === "done" ? (
        <p className="mt-3 text-sm text-slate-600">
          The installer is saving to your Downloads folder. Open it to install.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
