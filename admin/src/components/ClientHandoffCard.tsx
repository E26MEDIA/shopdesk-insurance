"use client";

import { useState } from "react";
import {
  buildClientEmailSubject,
  buildClientMessage,
} from "@/lib/client-handoff";

const PUBLIC_DOWNLOAD_PAGE = "https://insurance.e26media.com/download";

export function ClientHandoffCard({
  shopName,
  clientEmail,
  licenseKey,
  onDismiss,
}: {
  shopName: string;
  clientEmail?: string;
  licenseKey: string;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState<"message" | "key" | null>(null);
  const downloadUrl =
    typeof window === "undefined"
      ? PUBLIC_DOWNLOAD_PAGE
      : `${window.location.origin}/download`;

  const message = buildClientMessage({ shopName, licenseKey, downloadUrl });
  const subject = buildClientEmailSubject(shopName);
  const mailto = clientEmail
    ? `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

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
          {clientEmail ? `Email ${clientEmail}` : "Open in email"}
        </a>
        {onDismiss ? (
          <button type="button" className="btn btn-secondary" onClick={onDismiss}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}
