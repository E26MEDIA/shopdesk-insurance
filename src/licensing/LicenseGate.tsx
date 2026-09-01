"use client";

import { useEffect, useState } from "react";

export type LicenseStatus = {
  valid: boolean;
  skip?: boolean;
  needsActivation?: boolean;
  needsOnlineRefresh?: boolean;
  offlineGraceExpired?: boolean;
  message: string;
  license?: {
    shopName?: string;
    edition?: string;
    productName?: string;
    expiryDate?: string | null;
    offlineUntil?: string;
  };
  modules?: string[];
};

export function ActivationScreen({
  onActivated,
}: {
  onActivated: () => void;
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    if (!window.shopdesk?.activateLicense) return;
    setLoading(true);
    setError("");
    try {
      const result = await window.shopdesk.activateLicense(licenseKey.trim());
      if (result?.code === "ACTIVATION_SUCCESS") {
        onActivated();
        return;
      }
      setError(result?.message || result?.code || "Activation failed.");
    } catch {
      setError("Could not reach licensing server. Check internet connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={activate}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="text-sm font-medium text-[#0f3d3e]">E26 Insurance Desk</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Activate your license
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the license key provided by E26. Your shop data stays on this
          computer — only licensing information is sent online.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="licenseKey">
          License key
        </label>
        <input
          id="licenseKey"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-[#0f3d3e]"
          placeholder="E26-INS-XXXX-XXXX-XXXX"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#0f3d3e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5c5e] disabled:opacity-60"
        >
          {loading ? "Activating…" : "Activate"}
        </button>
      </form>
    </div>
  );
}

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.shopdesk?.getLicenseStatus) {
        if (!cancelled) {
          setStatus({ valid: true, message: "Browser mode" });
          setChecking(false);
        }
        return;
      }
      const s = await window.shopdesk.getLicenseStatus();
      if (cancelled) return;
      setStatus(s);
      setChecking(false);

      if (s?.needsOnlineRefresh && window.shopdesk.refreshLicense) {
        try {
          const online = await window.shopdesk.refreshLicense();
          if (!cancelled && online?.code === "VALIDATION_SUCCESS") {
            const next = await window.shopdesk.getLicenseStatus();
            setStatus(next);
          }
        } catch {
          /* offline grace */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        Checking license…
      </div>
    );
  }

  if (!status?.valid && status?.needsActivation) {
    return <ActivationScreen onActivated={() => window.location.reload()} />;
  }

  if (!status?.valid && status?.offlineGraceExpired) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">License validation required</h1>
        <p className="mt-3 text-sm text-slate-600">{status.message}</p>
        <p className="mt-2 text-sm text-slate-500">
          Your insurance data is safe on this computer. Connect to the internet and
          restart the app, or click below to retry.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-[#0f3d3e] px-4 py-2 text-sm text-white"
          onClick={() => window.location.reload()}
        >
          Retry validation
        </button>
      </div>
    );
  }

  if (!status?.valid && !status?.skip) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">
        {status?.message || "License not valid."}
      </div>
    );
  }

  return (
    <>
      {status?.needsOnlineRefresh && status?.valid ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          Offline mode — license validation will refresh when internet is available.
        </div>
      ) : null}
      {children}
    </>
  );
}
