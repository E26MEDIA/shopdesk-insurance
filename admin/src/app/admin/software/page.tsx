"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

export default function SoftwarePage() {
  const [version, setVersion] = useState("0.1.0");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [mandatoryUpdate, setMandatoryUpdate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/v1/software/latest")
      .then((r) => r.json())
      .then((d) => {
        if (d.version) setVersion(d.version);
        if (d.downloadUrl) setDownloadUrl(d.downloadUrl);
        if (d.releaseNotes) setReleaseNotes(d.releaseNotes);
        if (typeof d.mandatoryUpdate === "boolean") {
          setMandatoryUpdate(d.mandatoryUpdate);
        }
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const res = await fetch("/api/admin/software-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        downloadUrl,
        releaseNotes,
        mandatoryUpdate,
      }),
    });
    if (res.ok) {
      setSaved(true);
      return;
    }
    setError("Could not save. Check the download URL and try again.");
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
          <li>Build the new <code>ShopDesk-Setup-x.y.z.exe</code> (bump version in package.json)</li>
          <li>Upload the .exe to Dropbox → Share → Copy link → change <code>dl=0</code> to <code>dl=1</code></li>
          <li>Enter that version, paste the link, write what changed, and publish</li>
          <li>Shop PCs download the installer themselves and click <strong>Install now</strong></li>
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
          <label className="label">Download URL (direct link to .exe)</label>
          <input
            className="input"
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            placeholder="https://..."
            required
          />
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
            Published. Shop computers will download this version in the app and
            install it from the popup. No need to send the download page again.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    </AdminShell>
  );
}
