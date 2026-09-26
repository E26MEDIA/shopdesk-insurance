"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SoftwareUpdateInfo, UpdateDownloadState } from "@/lib/persist";
import {
  APP_VERSION,
  checkSoftwareUpdate,
  idleDownloadState,
  postponeUpdate,
  postponedVersion,
  previewUpdateInfo,
} from "@/lib/softwareUpdate";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

type UpdateContextValue = {
  update: SoftwareUpdateInfo | null;
  currentVersion: string;
  modalOpen: boolean;
  checking: boolean;
  downloading: boolean;
  installReady: boolean;
  installError: string;
  openModal: () => void;
  remindLater: () => void;
  installOrDownload: () => void;
  checkNow: () => Promise<SoftwareUpdateInfo>;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

function emptyUpdate(): SoftwareUpdateInfo {
  return {
    available: false,
    mandatory: false,
    currentVersion: APP_VERSION,
    latestVersion: null,
    downloadUrl: null,
    downloadPageUrl: "https://insurance.e26media.com/download",
    releaseNotes: "",
    releaseDate: null,
  };
}

export function useSoftwareUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    return {
      update: null,
      currentVersion: APP_VERSION,
      modalOpen: false,
      checking: false,
      downloading: false,
      installReady: false,
      installError: "",
      openModal: () => undefined,
      remindLater: () => undefined,
      installOrDownload: () => undefined,
      checkNow: async () => emptyUpdate(),
    };
  }
  return ctx;
}

function wantsPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("previewUpdate") === "1";
}

function mergeDownload(
  info: SoftwareUpdateInfo,
  download: UpdateDownloadState,
): SoftwareUpdateInfo {
  return { ...info, download, canInstallInApp: true };
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [update, setUpdate] = useState<SoftwareUpdateInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installError, setInstallError] = useState("");
  const [installing, setInstalling] = useState(false);
  const previewStarted = useRef(false);
  const previewLoaded = useRef(false);
  const dismissedThisSession = useRef(false);

  const applyResult = useCallback((result: SoftwareUpdateInfo, forceModal = false) => {
    setUpdate(result);
    if (!result.available) {
      setModalOpen(false);
      return result;
    }
    if (dismissedThisSession.current && !forceModal) return result;
    const postponed = postponedVersion();
    if (forceModal || result.mandatory || postponed !== result.latestVersion) {
      setModalOpen(true);
    }
    return result;
  }, []);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      if (wantsPreview()) {
        if (!previewLoaded.current) {
          previewLoaded.current = true;
          return applyResult(previewUpdateInfo());
        }
        return previewUpdateInfo();
      }
      const result = await checkSoftwareUpdate();
      return applyResult(result);
    } finally {
      setChecking(false);
    }
  }, [applyResult]);

  useEffect(() => {
    const start = window.setTimeout(() => {
      void checkNow();
    }, 0);
    const timer = window.setInterval(() => {
      void checkNow();
    }, CHECK_INTERVAL_MS);
    let lastFocusCheck = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFocusCheck < 60_000) return;
      lastFocusCheck = Date.now();
      void checkNow();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkNow]);

  useEffect(() => {
    if (!window.shopdesk?.onUpdateProgress) return;
    return window.shopdesk.onUpdateProgress((snapshot) => {
      setUpdate((current) => (current?.available ? mergeDownload(current, snapshot) : current));
    });
  }, []);

  useEffect(() => {
    if (!update?.available || !wantsPreview() || previewStarted.current) return;
    previewStarted.current = true;
    let percent = 0;
    const timer = window.setInterval(() => {
      percent = Math.min(100, percent + 20);
      const snapshot: UpdateDownloadState =
        percent >= 100
          ? {
              status: "ready",
              version: "0.2.0",
              percent: 100,
              received: 100,
              total: 100,
              path: "preview",
              error: null,
            }
          : {
              status: "downloading",
              version: "0.2.0",
              percent,
              received: percent,
              total: 100,
              path: null,
              error: null,
            };
      setUpdate((current) => (current?.available ? mergeDownload(current, snapshot) : current));
      if (percent >= 100) window.clearInterval(timer);
    }, 180);
    return () => window.clearInterval(timer);
  }, [update?.available]);

  useEffect(() => {
    if (!update?.available || !window.shopdesk?.downloadUpdate) return;
    if (update.download?.status === "ready" || update.download?.status === "downloading") {
      return;
    }
    void window.shopdesk.downloadUpdate().then((result) => {
      setUpdate((current) => current?.available ? { ...current, ...result } : current);
    });
  }, [update?.available, update?.download?.status]);

  const openModal = useCallback(() => {
    if (update?.available) setModalOpen(true);
  }, [update?.available]);

  const remindLater = useCallback(() => {
    dismissedThisSession.current = true;
    if (update?.latestVersion && !update.mandatory) postponeUpdate(update.latestVersion);
    setModalOpen(false);
  }, [update]);

  const installOrDownload = useCallback(async () => {
    setInstallError("");
    if (wantsPreview() && update?.download?.status === "ready") {
      setInstalling(true);
      window.setTimeout(() => {
        setInstalling(false);
        setUpdate((current) =>
          current
            ? {
                ...current,
                download: {
                  status: "ready",
                  version: current.latestVersion,
                  percent: 100,
                  received: 100,
                  total: 100,
                  path: "preview",
                  error: null,
                },
              }
            : current,
        );
        setInstallError("PREVIEW_INSTALLED");
      }, 600);
      return;
    }
    if (window.shopdesk?.installUpdate && update?.download?.status === "ready") {
      setInstalling(true);
      try {
        const result = await window.shopdesk.installUpdate();
        if (!result?.ok) {
          setInstallError(result?.error || "Could not start the installer.");
        }
      } catch {
        setInstallError("Could not start the installer.");
      } finally {
        setInstalling(false);
      }
      return;
    }
    if (window.shopdesk?.downloadUpdate) {
      void window.shopdesk.downloadUpdate();
    }
  }, [update?.download?.status]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        remindLater();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, remindLater, update?.mandatory]);

  const download = update?.download || idleDownloadState();
  const downloading = download.status === "downloading" || installing;
  const installReady = download.status === "ready";

  const value = useMemo(
    () => ({
      update,
      currentVersion: update?.currentVersion || APP_VERSION,
      modalOpen,
      checking,
      downloading,
      installReady,
      installError,
      openModal,
      remindLater,
      installOrDownload: () => {
        void installOrDownload();
      },
      checkNow,
    }),
    [
      update,
      modalOpen,
      checking,
      downloading,
      installReady,
      installError,
      openModal,
      remindLater,
      installOrDownload,
      checkNow,
    ],
  );

  return (
    <UpdateContext.Provider value={value}>
      {children}
      {modalOpen && update?.available ? (
        <UpdatePopup
          update={update}
          downloading={downloading}
          installReady={installReady}
          installing={installing}
          installError={installError}
          onLater={remindLater}
          onInstall={installOrDownload}
        />
      ) : null}
    </UpdateContext.Provider>
  );
}

function UpdatePopup({
  update,
  downloading,
  installReady,
  installing,
  installError,
  onLater,
  onInstall,
}: {
  update: SoftwareUpdateInfo;
  downloading: boolean;
  installReady: boolean;
  installing: boolean;
  installError: string;
  onLater: () => void;
  onInstall: () => void;
}) {
  const notes = String(update.releaseNotes || "").trim();
  const percent = update.download?.percent ?? 0;
  const previewDone = installError === "PREVIEW_INSTALLED";
  const errorText = previewDone ? "" : installError || update.download?.error || "";

  let actionLabel = "Download and install";
  if (installing) actionLabel = "Starting installer…";
  else if (downloading && !installReady) actionLabel = `Downloading… ${percent}%`;
  else if (installReady) actionLabel = "Install now";

  return (
    <div
      className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopdesk-update-title"
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-6 pb-5 pt-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f3d3e] text-xs font-bold text-white">
            E26
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f3d3e]">
            Software update
          </p>
          <h2
            id="shopdesk-update-title"
            className="mt-1 text-xl font-semibold tracking-tight text-slate-900"
          >
            {previewDone ? "Installer ready" : installReady ? "Restart to update" : "Update available"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {previewDone ? (
              <>
                On a shop computer, Insurance Desk closes now and version{" "}
                <span className="font-medium text-slate-900">{update.latestVersion}</span>{" "}
                installs by itself. No download page.
              </>
            ) : (
              <>
                Insurance Desk{" "}
                <span className="font-medium text-slate-900">
                  {update.latestVersion}
                </span>{" "}
                will install on this computer. You are on {update.currentVersion}. You do
                not need the website.
              </>
            )}
          </p>
          {update.mandatory ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
              This update is required. Install it here — do not go to the download page.
            </p>
          ) : null}
          {downloading && !installReady && !previewDone ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#0f3d3e] transition-all"
                  style={{ width: `${Math.max(8, percent)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Downloading the new version on this PC…
              </p>
            </div>
          ) : null}
          {notes && !previewDone ? (
            <div className="mt-4 max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
              {notes}
            </div>
          ) : null}
          {errorText ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {!previewDone ? (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              onClick={onLater}
            >
              Keep working
            </button>
          ) : null}
          {previewDone ? (
            <button
              type="button"
              className="rounded-lg bg-[#0f3d3e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a5c5e]"
              onClick={onLater}
            >
              OK
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-[#0f3d3e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a5c5e] disabled:opacity-60"
              onClick={onInstall}
              disabled={installing || (downloading && !installReady)}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
