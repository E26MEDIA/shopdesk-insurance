"use client";

import { useEffect, useState } from "react";
import {
  buildClientEmailSubject,
  buildClientMessage,
} from "@/lib/client-handoff";

export function ClientHandoffCard({
  shopName,
  licenseKey,
  onDismiss,
}: {
  shopName: string;
  licenseKey: string;
  onDismiss?: () => void;
}) {
  const [downloadUrl, setDownloadUrl] = useState("");
  const [copied, setCopied] = useState<"message" | "key" | null>(null);

  useEffect(() => {
    void fetch("/api/v1/download")
      .then((r) => r.json())
      .then((d: { downloadUrl?: string | null }) => {
        setDownloadUrl(d.downloadUrl || "https://insurance.e26media.com/download");
      })
      .catch(() => setDownloadUrl("https://insurance.e26media.com/download"));
  }, []);

  const message = buildClientMessage({ shopName, licenseKey, downloadUrl });
  const subject = buildClientEmailSubject(shopName);
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  async function copy(text: string, kind: "message" | "key") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="card mb-6 border-emerald-200 bg-emerald-50">
      <h2 className="text-lg font-semibold text-emerald-950">
        Send to client — copy &amp; email
      </h2>
      <p className="mt-1 text-sm text-emerald-900">
        Email or WhatsApp this to <strong>{shopName}</strong>. You only send the
        download link + license key — nothing else.
      </p>

      <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          License key
        </p>
        <p className="mt-1 font-mono text-lg text-slate-900">{licenseKey}</p>
        <button
          type="button"
          className="btn btn-secondary mt-2"
          onClick={() => void copy(licenseKey, "key")}
        >
          {copied === "key" ? "Copied!" : "Copy license key"}
        </button>
      </div>

      <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-emerald-200 bg-white p-4 text-sm whitespace-pre-wrap text-slate-800">
        {message}
      </pre>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void copy(message, "message")}
        >
          {copied === "message" ? "Copied!" : "Copy full message"}
        </button>
        <a href={mailto} className="btn btn-secondary">
          Open in email
        </a>
        {onDismiss ? (
          <button type="button" className="btn btn-secondary" onClick={onDismiss}>
            Done
          </button>
        ) : null}
      </div>

      {!downloadUrl.includes("drive.google") &&
      downloadUrl.endsWith("/download") ? (
        <p className="mt-3 text-xs text-amber-900">
          Tip: Set your .exe link once in Admin → Download so clients get a direct
          file link.
        </p>
      ) : null}
    </div>
  );
}
