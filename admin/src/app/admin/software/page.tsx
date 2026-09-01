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
      <p className="mb-4 text-sm text-slate-600">
        Build the real installer on Windows (<code>npm run desktop:dist:win</code>).
        Upload <code>ShopDesk-Setup-0.1.0.exe</code> (~200 MB) to Google Drive,
        then paste the direct download link below. Customers use:{" "}
        <a href="/download" className="text-[#0f3d3e] underline">
          {publicDownloadPage}
        </a>
      </p>

      <div className="card mb-6 max-w-xl space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Google Drive direct link</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Upload .exe to Google Drive → Share → Anyone with link</li>
          <li>
            Convert share URL to:{" "}
            <code className="text-xs">
              https://drive.google.com/uc?export=download&amp;id=FILE_ID
            </code>
          </li>
          <li>Paste below and save</li>
        </ol>
        <p className="text-xs text-amber-800">
          Do not host the small 158 KB file from the cloud build — Chrome flags it.
          Build on your Windows PC for the full ~200 MB installer.
        </p>
      </div>

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
