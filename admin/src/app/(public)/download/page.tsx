import { BrandLogo } from "@/components/BrandLogo";
import { getPublicDownloadInfo } from "@/lib/public-download";

export default async function DownloadPage() {
  const info = await getPublicDownloadInfo();
  const fileName = `ShopDesk-Setup-${info.version}.exe`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7f7] px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <BrandLogo className="mb-4" />
        <h1 className="text-2xl font-semibold text-slate-900">
          Download for Windows
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Install on your shop computer. Internet is needed once for license activation;
          daily work is offline. Later versions install from a popup inside Insurance Desk
          — you will not need this page again.
        </p>

        {info.downloadUrl ? (
          <div className="mt-6">
            <p className="mb-3 text-sm text-slate-600">
              Version <strong>{info.version}</strong>
            </p>
            <a
              href={info.downloadUrl}
              download={fileName}
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
      </div>
    </div>
  );
}
