"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

type SavedVersion = {
  version?: string;
  downloadUrl?: string;
  releaseNotes?: string | null;
  mandatoryUpdate?: boolean;
};

export default function SoftwarePage() {
  const [version, setVersion] = useState("0.1.0");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [mandatoryUpdate, setMandatoryUpdate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function loadCurrent() {
    const res = await fetch("/api/admin/software-versions", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const d = (await res.json()) as SavedVersion;
    if (d.version) setVersion(d.version);
    setDownloadUrl(d.downloadUrl || "");
    setReleaseNotes(d.releaseNotes || "");
    if (typeof d.mandatoryUpdate === "boolean") {
      setMandatoryUpdate(d.mandatoryUpdate);
    }
  }

  useEffect(() => {
    void loadCurrent();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const res = await fetch("/api/admin/software-versions", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        downloadUrl,
        releaseNotes,
        mandatoryUpdate,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      version?: SavedVersion;
    };
    if (res.status === 401) {
      setError("Session expired. Log in again, then publish.");
      return;
    }
    if (!res.ok) {
      setError(
        data.error === "INVALID_INPUT"
          ? "That installer URL is not valid. Paste the full Dropbox share link."
          : "Could not save. Check the download URL and try again.",
      );
      return;
    }
    const row = data.version;
    if (row?.downloadUrl) setDownloadUrl(row.downloadUrl);
    if (row?.version) setVersion(row.version);
    setSaved(true);
  }

  const publicDownloadPage =
    typeof window !== "undefined"
      ? `${window.location.origin}/download`
      : "https://insurance.e26media.com/download";

  return (
    <AdminShell>
      <h1 className="mb-2 text-2xl font-semibold">Software updates</h1>
      <p className="mb-4 text-sm text-slate-600">
        After shops already have Insurance Desk, publish the next installer here.
        Their app downloads it in the background and installs from the popup —
        you do not tell them to open the download page again.
      </p>

      <div className="card mb-6 max-w-xl space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-900">How shops get the next version</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Build the new installer on Windows (<code>npm run desktop:dist:win</code>). Use the zip the builder writes next to the exe.</li>
          <li>Upload <code>ShopDesk-Setup-x.y.z.exe.zip</code> (not the raw .exe) to Dropbox → Share → Copy link</li>
          <li>Paste that zip link here and publish. Chrome blocks .exe downloads from the website. Windows Defender may still warn until the installer is code-signed.</li>
        </ol>
        <p className="pt-1 text-slate-500">
          First-time install still uses{" "}
          <a href="/download" className="text-[#0f3d3e] underline">
            {publicDownloadPage}
          </a>
          . Later updates stay inside the app.
        </p>
      </div>

      <form onSubmit={save} className="card max-w-xl space-y-4">
        <div>
          <label className="label">Version</label>
          <input
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="0.2.0"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Must be higher than the installed app version (currently 0.1.0 in shops)
            or the popup will not appear.
          </p>
        </div>
        <div>
          <label className="label">Installer URL (Dropbox / Drive share link)</label>
          <input
            className="input"
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            placeholder="https://www.dropbox.com/scl/fi/…/ShopDesk-Setup-0.1.1.exe.zip"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Paste the Dropbox share link to the <strong>.zip</strong> file (not
            the .exe). Customers download from{" "}
            <a href="/download" className="text-[#0f3d3e] underline">
              {publicDownloadPage}
            </a>
            — they should not land on Dropbox.
          </p>
        </div>
        <div>
          <label className="label">What&apos;s new (shown in the popup)</label>
          <textarea
            className="input min-h-[80px]"
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            placeholder="Faster reports, bug fixes, …"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={mandatoryUpdate}
            onChange={(e) => setMandatoryUpdate(e.target.checked)}
          />
          <span>
            Required update — shops cannot dismiss the popup with Later.
          </span>
        </label>
        <button type="submit" className="btn btn-primary">
          Publish update
        </button>
        {saved ? (
          <p className="text-sm text-emerald-700">
            Saved. Refresh this page — the zip link should still be here. Customers
            use{" "}
            <a href="/download" className="underline">
              {publicDownloadPage}
            </a>
            .
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    </AdminShell>
  );
}
