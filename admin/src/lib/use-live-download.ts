"use client";

import { useEffect, useState } from "react";
import {
  isZipInstallerUrl,
  toCorsInstallerUrl,
  toDirectDownloadUrl,
} from "@/lib/download-url";

export type LiveDownloadInfo = {
  version: string;
  downloadUrl: string | null;
  releaseNotes?: string | null;
};

export function useLiveDownload() {
  const [info, setInfo] = useState<LiveDownloadInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/v1/download?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Download info failed");
        return (await res.json()) as LiveDownloadInfo;
      })
      .then((data) => {
        setInfo(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const incoming = info?.downloadUrl || "";
  const href =
    (isZipInstallerUrl(incoming)
      ? toDirectDownloadUrl(incoming)
      : toCorsInstallerUrl(incoming)) || "";

  return {
    status,
    version: info?.version || "",
    href,
    releaseNotes: info?.releaseNotes || "",
    fileName: `ShopDesk-Setup-${info?.version || "installer"}.exe`,
  };
}
