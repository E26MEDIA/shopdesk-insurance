"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SoftwareUpdateInfo } from "@/lib/persist";
import {
  APP_VERSION,
  checkSoftwareUpdate,
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
  openModal: () => void;
  remindLater: () => void;
  downloadUpdate: () => void;
  checkNow: () => Promise<SoftwareUpdateInfo>;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function useSoftwareUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    return {
      update: null,
      currentVersion: APP_VERSION,
      modalOpen: false,
      checking: false,
      openModal: () => undefined,
      remindLater: () => undefined,
      downloadUpdate: () => undefined,
      checkNow: async () =>
        ({
          available: false,
          mandatory: false,
          currentVersion: APP_VERSION,
          latestVersion: null,
          downloadUrl: null,
          downloadPageUrl: "https://insurance.e26media.com/download",
          releaseNotes: "",
          releaseDate: null,
        }) satisfies SoftwareUpdateInfo,
    };
  }
  return ctx;
}

function wantsPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("previewUpdate") === "1";
}

async function openDownload(url: string) {
  if (window.shopdesk?.openExternal) {
    await window.shopdesk.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [update, setUpdate] = useState<SoftwareUpdateInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const applyResult = useCallback((result: SoftwareUpdateInfo, forceModal = false) => {
    setUpdate(result);
    if (!result.available) {
      setModalOpen(false);
      return result;
    }
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
        return applyResult(previewUpdateInfo());
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

  const openModal = useCallback(() => {
    if (update?.available) setModalOpen(true);
  }, [update?.available]);

  const remindLater = useCallback(() => {
    if (!update?.latestVersion || update.mandatory) return;
    postponeUpdate(update.latestVersion);
    setModalOpen(false);
  }, [update]);

  const downloadUpdate = useCallback(() => {
    const url = update?.downloadUrl || update?.downloadPageUrl;
    if (!url) return;
    void openDownload(url);
  }, [update]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !update?.mandatory) {
        remindLater();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, remindLater, update?.mandatory]);

  const value = useMemo(
    () => ({
      update,
      currentVersion: update?.currentVersion || APP_VERSION,
      modalOpen,
      checking,
      openModal,
      remindLater,
      downloadUpdate,
      checkNow,
    }),
    [
      update,
      modalOpen,
      checking,
      openModal,
      remindLater,
      downloadUpdate,
      checkNow,
    ],
  );

  return (
    <UpdateContext.Provider value={value}>
      {children}
      {modalOpen && update?.available ? (
        <UpdatePopup
          update={update}
          onLater={remindLater}
          onDownload={downloadUpdate}
        />
      ) : null}
    </UpdateContext.Provider>
  );
}

function UpdatePopup({
  update,
  onLater,
  onDownload,
}: {
  update: SoftwareUpdateInfo;
  onLater: () => void;
  onDownload: () => void;
}) {
  const notes = String(update.releaseNotes || "").trim();

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
            Update available
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Insurance Desk{" "}
            <span className="font-medium text-slate-900">
              {update.latestVersion}
            </span>{" "}
            is ready. You are on {update.currentVersion}.
          </p>
          {update.mandatory ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
              This update is required. Download the new installer to continue using
              the latest Insurance Desk.
            </p>
          ) : null}
          {notes ? (
            <div className="mt-4 max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
              {notes}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {!update.mandatory ? (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              onClick={onLater}
            >
              Later
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg bg-[#0f3d3e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a5c5e]"
            onClick={onDownload}
          >
            Download update
          </button>
        </div>
      </div>
    </div>
  );
}
