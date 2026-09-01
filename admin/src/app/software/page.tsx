"use client";

import { AdminShell } from "@/components/AdminShell";
import { useEffect, useState } from "react";

export default function SoftwarePage() {
  const [version, setVersion] = useState("0.1.0");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/software/latest")
      .then((r) => r.json())
      .then((d) => {
        if (d.version) setVersion(d.version);
        if (d.downloadUrl) setDownloadUrl(d.downloadUrl);
        if (d.releaseNotes) setReleaseNotes(d.releaseNotes);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/software-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, downloadUrl, releaseNotes }),
    });
    setSaved(res.ok);
  }

  const publicDownloadPage =
    typeof window !== "undefined"
      ? `${window.location.origin}/download`
      : "https://shopdesk-insurance-phi.vercel.app/download";

  return (
    <AdminShell>
      <h1 className="mb-2 text-2xl font-semibold">Software download</h1>
      <p className="mb-6 text-sm text-slate-600">
        Upload the <code>.exe</code> to Google Drive / Dropbox / GitHub Releases,
        paste the direct download link here. Customers use:{" "}
        <a href="/download" className="text-[#0f3d3e] underline">
          {publicDownloadPage}
        </a>
      </p>

      <form onSubmit={save} className="card max-w-xl space-y-4">
        <div>
          <label className="label">Version</label>
          <input
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
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
          <label className="label">Release notes</label>
          <textarea
            className="input min-h-[80px]"
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Save download link
        </button>
        {saved ? (
          <p className="text-sm text-emerald-700">Saved. Customer page updated.</p>
        ) : null}
      </form>
    </AdminShell>
  );
}
