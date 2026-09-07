import { BrandLogo } from "@/components/BrandLogo";
import { LiveDownloadPanel } from "@/components/LiveDownloadPanel";

export default function DownloadPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f4f7f7] px-4">
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
        <LiveDownloadPanel />
      </div>
    </div>
  );
}
