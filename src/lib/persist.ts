import type { AppData } from "./types";
import { emptyData, STORAGE_KEY } from "./utils";
import { mergeFormFields } from "./formFields";

const OFFICE_SERVER_KEY = "shopdesk-office-server-url-v1";
const OFFICE_DEVICE_KEY = "shopdesk-office-device-id-v1";
const OFFICE_COMPUTER_LABEL_KEY = "shopdesk-office-computer-label-v1";
const OFFICE_ACCESS_KEY = "shopdesk-office-access-key-v1";
type OfficeSnapshot = { revision: number; updatedAt: string; data: AppData };
let officeRevision: number | null = null;
let officeBaseData: AppData | null = null;
let officeSaveQueue: Promise<void> = Promise.resolve();

export type ShopdeskBridge = {
  isOfflineApp: true;
  getMode: () => Promise<{
    offline: boolean;
    dataPath: string;
    docsPath?: string;
    reportsPath?: string;
    shared?: boolean;
  }>;
  loadData: () => Promise<AppData | null>;
  saveData: (data: AppData) => Promise<boolean>;
  saveDoc: (payload: {
    fileId?: string;
    base64: string;
    mime: string;
    name: string;
    clientName?: string;
    type?: string;
  }) => Promise<{ fileId: string; size: number; path?: string }>;
  readDoc: (
    fileId: string,
  ) => Promise<{ fileId: string; name: string; mime: string; dataUrl: string } | null>;
  deleteDoc: (fileId: string) => Promise<boolean>;
  openDataFolder: () => Promise<boolean>;
  savePdfReport: (payload: {
    html: string;
    kind: string;
    date?: string;
  }) => Promise<{ path: string; fileName: string; date: string }>;
  openReportsFolder: () => Promise<boolean>;
  print: () => Promise<boolean>;
  startOfficeServer: () => Promise<{
    running: boolean;
    started: boolean;
    localUrl?: string;
    lanUrls?: string[];
  }>;
  getOfficeLanInfo?: () => Promise<{ localUrl: string; lanUrls: string[] }>;
  getLicenseStatus: () => Promise<import("../licensing/types").LicenseStatus>;
  activateLicense: (licenseKey: string) => Promise<Record<string, unknown>>;
  refreshLicense: () => Promise<Record<string, unknown>>;
};

declare global {
  interface Window {
    shopdesk?: ShopdeskBridge;
  }
}

export function isOfflineDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.shopdesk?.isOfflineApp);
}

export function getOfficeServerUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OFFICE_SERVER_KEY) || null;
}

export function isSharedOffice(): boolean {
  return Boolean(getOfficeServerUrl());
}

export function getOfficeComputerLabel(): string {
  if (typeof window === "undefined") return "ShopDesk Windows computer";
  return localStorage.getItem(OFFICE_COMPUTER_LABEL_KEY) || "ShopDesk Windows computer";
}

export function setOfficeComputerLabel(label: string): void {
  localStorage.setItem(OFFICE_COMPUTER_LABEL_KEY, label.trim().slice(0, 80) || "ShopDesk Windows computer");
}

export function getOfficeAccessKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(OFFICE_ACCESS_KEY) || "";
}

export function setOfficeAccessKey(key: string): void {
  localStorage.setItem(OFFICE_ACCESS_KEY, key.trim());
}

async function officeFetch(path: string, init: RequestInit = {}, url = getOfficeServerUrl()): Promise<Response> {
  if (!url) throw new Error("This computer is not connected to the office server");
  const headers = new Headers(init.headers);
  const key = getOfficeAccessKey();
  if (key) headers.set("X-ShopDesk-Office-Key", key);
  return fetch(`${url}${path}`, { ...init, headers });
}

export function setOfficeServerUrl(value: string): void {
  const normalized = value.trim().replace(/\/$/, "");
  if (!normalized) localStorage.removeItem(OFFICE_SERVER_KEY);
  else localStorage.setItem(OFFICE_SERVER_KEY, normalized);
  officeRevision = null;
  officeBaseData = null;
}

export async function checkOfficeServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health`);
    const body = (await response.json()) as { ok?: boolean };
    return response.ok && body.ok === true;
  } catch {
    return false;
  }
}

export type OfficeStatus = {
  ok: boolean;
  startedAt: string;
  port: number;
  backupHour: number;
  clients: { id: string; label: string; lastSeen: string }[];
  latestBackup: { file: string; createdAt: string } | null;
};

export type OfficeActivity = { id: number; createdAt: string; computer: string; summary: string };

function officeDeviceId(): string {
  let id = localStorage.getItem(OFFICE_DEVICE_KEY);
  if (!id) {
    id = `pc_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(OFFICE_DEVICE_KEY, id);
  }
  return id;
}

export async function heartbeatOffice(): Promise<void> {
  const url = getOfficeServerUrl();
  if (!url) return;
  await officeFetch("/api/v1/clients/heartbeat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: officeDeviceId(), label: getOfficeComputerLabel() }),
  });
}

export async function getOfficeStatus(): Promise<OfficeStatus | null> {
  const url = getOfficeServerUrl();
  if (!url) return null;
  try {
    const response = await officeFetch("/api/v1/status", { cache: "no-store" }, url);
    return response.ok ? (await response.json()) as OfficeStatus : null;
  } catch {
    return null;
  }
}

export async function getOfficeActivity(): Promise<OfficeActivity[]> {
  const url = getOfficeServerUrl();
  if (!url) return [];
  const response = await officeFetch("/api/v1/activity?limit=20", { cache: "no-store" }, url);
  if (!response.ok) throw new Error("Could not load activity history");
  return ((await response.json()) as { entries: OfficeActivity[] }).entries;
}

export async function createOfficeBackup(): Promise<{ database: string; documents: string }> {
  const url = getOfficeServerUrl();
  if (!url) throw new Error("This computer is not connected to the office server");
  const response = await officeFetch("/api/v1/backups", { method: "POST" }, url);
  if (!response.ok) throw new Error("Could not create the backup");
  return (await response.json()) as { database: string; documents: string };
}

export async function listOfficeBackups(): Promise<{ file: string; createdAt: string }[]> {
  const url = getOfficeServerUrl();
  if (!url) return [];
  const response = await officeFetch("/api/v1/backups", { cache: "no-store" }, url);
  if (!response.ok) throw new Error("Could not read backups");
  const body = (await response.json()) as { backups: { file: string; createdAt: string }[] };
  return body.backups;
}

export async function restoreOfficeBackup(file: string, pin: string): Promise<{ restored: string; safetyBackup: string }> {
  const url = getOfficeServerUrl();
  if (!url) throw new Error("This computer is not connected to the office server");
  const response = await officeFetch("/api/v1/backups/restore", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, pin }),
  });
  const body = (await response.json()) as { restored?: string; safetyBackup?: string; error?: string };
  if (!response.ok || !body.restored || !body.safetyBackup) throw new Error(body.error || "Restore failed");
  return { restored: body.restored, safetyBackup: body.safetyBackup };
}

export async function officeAdminPinConfigured(): Promise<boolean> {
  const url = getOfficeServerUrl();
  if (!url) return false;
  const response = await officeFetch("/api/v1/admin-pin", { cache: "no-store" }, url);
  if (!response.ok) return false;
  return ((await response.json()) as { configured: boolean }).configured;
}

export async function setOfficeAdminPin(pin: string, currentPin = ""): Promise<void> {
  const url = getOfficeServerUrl();
  if (!url) throw new Error("Connect to the office server first");
  const response = await officeFetch("/api/v1/admin-pin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set", pin, currentPin }),
  });
  if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "Could not save Admin PIN");
}

/** Prompts only when an Admin PIN is configured for the shared office server. */
export async function requireOfficeAdminPin(action: string): Promise<boolean> {
  const url = getOfficeServerUrl();
  if (!url || !(await officeAdminPinConfigured())) return true;
  const pin = window.prompt(`Admin PIN required to ${action}`);
  if (pin === null) return false;
  const response = await officeFetch("/api/v1/admin-pin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", pin }),
  });
  return response.ok && ((await response.json()) as { valid: boolean }).valid;
}

export async function configureOfficeAccessKey(key: string, pin: string): Promise<void> {
  const url = getOfficeServerUrl();
  if (!url) throw new Error("Connect to the office server first");
  const response = await fetch(`${url}/api/v1/access-key`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set", key, pin }),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error || "Could not save Office Access Key");
  setOfficeAccessKey(key);
}

async function fetchOfficeSnapshot(url: string): Promise<OfficeSnapshot> {
  const response = await officeFetch("/api/v1/data", { cache: "no-store" }, url);
  if (!response.ok) throw new Error("Office server is unavailable");
  const body = (await response.json()) as OfficeSnapshot;
  return { ...body, data: migrateParsed(body.data) };
}

async function putOfficeSnapshot(url: string, data: AppData, revision: number): Promise<number> {
  const response = await officeFetch("/api/v1/data", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json", "If-Match": String(revision),
      "X-ShopDesk-Device": officeDeviceId(), "X-ShopDesk-Label": getOfficeComputerLabel(),
    },
    body: JSON.stringify({ data }),
  });
  if (response.status === 409) throw new Error("Office data changed on another computer");
  if (!response.ok) throw new Error("Could not save to the office server");
  const body = (await response.json()) as { revision: number };
  return body.revision;
}

export async function pollOfficeData(): Promise<AppData | null> {
  const url = getOfficeServerUrl();
  if (!url) return null;
  try {
    const remote = await fetchOfficeSnapshot(url);
    if (remote.revision === officeRevision) return null;
    officeRevision = remote.revision;
    officeBaseData = remote.data;
    return remote.data;
  } catch {
    return null;
  }
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeRows<T extends { id: string }>(base: T[], mine: T[], theirs: T[]): T[] {
  const baseMap = new Map(base.map((row) => [row.id, row]));
  const mineMap = new Map(mine.map((row) => [row.id, row]));
  const theirMap = new Map(theirs.map((row) => [row.id, row]));
  const ids = new Set([...baseMap.keys(), ...mineMap.keys(), ...theirMap.keys()]);
  const merged: T[] = [];
  for (const id of ids) {
    const before = baseMap.get(id);
    const ours = mineMap.get(id);
    const current = theirMap.get(id);
    // A change made on just one computer wins; if the same row was edited on
    // both computers, keep this computer's version and avoid losing other rows.
    const result = same(ours, before) ? current : ours;
    if (result) merged.push(result);
  }
  return merged;
}

function mergeAppData(base: AppData, mine: AppData, theirs: AppData): AppData {
  return {
    ...theirs,
    clients: mergeRows(base.clients, mine.clients, theirs.clients),
    vehicles: mergeRows(base.vehicles, mine.vehicles, theirs.vehicles),
    policies: mergeRows(base.policies, mine.policies, theirs.policies),
    pucEntries: mergeRows(base.pucEntries, mine.pucEntries, theirs.pucEntries),
    expenses: mergeRows(base.expenses, mine.expenses, theirs.expenses),
    adjustments: mergeRows(base.adjustments, mine.adjustments, theirs.adjustments),
    formFields: mergeRows(base.formFields, mine.formFields, theirs.formFields),
    masters: Object.fromEntries(
      Object.keys({ ...base.masters, ...mine.masters, ...theirs.masters }).map((key) => [
        key,
        mergeRows(
          base.masters[key as keyof AppData["masters"]] || [],
          mine.masters[key as keyof AppData["masters"]] || [],
          theirs.masters[key as keyof AppData["masters"]] || [],
        ),
      ]),
    ) as AppData["masters"],
  };
}

/** Opens the native printer dialog in desktop mode, or browser printing online. */
export async function printPage(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.shopdesk?.print) {
    await window.shopdesk.print();
  } else {
    window.print();
  }
}

export async function startOfficeServerOnThisPc(): Promise<{
  running: boolean;
  started: boolean;
  localUrl?: string;
  lanUrls?: string[];
}> {
  if (!window.shopdesk?.startOfficeServer) throw new Error("Open the installed ShopDesk desktop app first");
  return window.shopdesk.startOfficeServer();
}

export async function getOfficeLanInfo(): Promise<{ localUrl: string; lanUrls: string[] }> {
  if (window.shopdesk?.getOfficeLanInfo) {
    return window.shopdesk.getOfficeLanInfo();
  }
  return { localUrl: "http://127.0.0.1:3457", lanUrls: [] };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((value) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

function migrateParsed(raw: string | AppData | null): AppData {
  if (!raw) return emptyData();
  try {
    const parsed = (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as Partial<AppData> & {
      policies?: AppData["policies"];
      pucEntries?: AppData["pucEntries"];
      clients?: AppData["clients"];
      vehicles?: AppData["vehicles"];
      expenses?: AppData["expenses"];
      adjustments?: AppData["adjustments"];
      masters?: AppData["masters"];
    };
    const base = emptyData();
    return {
      ...base,
      ...parsed,
      clients: parsed.clients || [],
      vehicles: parsed.vehicles || [],
      policies: (parsed.policies || []).map((p) => {
        const pct =
          typeof p.companyOfferPercent === "number"
            ? p.companyOfferPercent
            : typeof p.companyOffer === "number" && p.companyOffer <= 100
              ? p.companyOffer
              : 0;
        return {
          ...p,
          companyOfferPercent: pct,
          tdsPercent: typeof p.tdsPercent === "number" ? p.tdsPercent : 2,
          points: typeof p.points === "number" ? p.points : 0,
          customerPayments: Array.isArray(p.customerPayments)
            ? p.customerPayments
            : p.received
              ? [{ id: "legacy", mode: p.paymentMode || "Other", amount: p.received }]
              : [],
          confirmed: Boolean(p.confirmed),
          customFields: p.customFields || {},
        };
      }),
      pucEntries: parsed.pucEntries || [],
      expenses: (parsed.expenses || []).map((e) => ({
        ...e,
        sign: e.sign === "+" || e.sign === "-" ? e.sign : ("-" as const),
      })),
      adjustments: parsed.adjustments || [],
      masters: { ...base.masters, ...(parsed.masters || {}) },
      formFields: mergeFormFields(parsed.formFields),
    };
  } catch {
    return emptyData();
  }
}

function loadFromLocalStorage(): AppData {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("insurance-shop-data-v2") ||
      localStorage.getItem("insurance-shop-data-v1");
    return migrateParsed(raw);
  } catch {
    return emptyData();
  }
}

export async function loadAppData(): Promise<AppData> {
  if (typeof window === "undefined") return emptyData();

  // Fast path: localStorage always works in the window
  const local = loadFromLocalStorage();

  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    try {
      const remote = await fetchOfficeSnapshot(officeUrl);
      officeRevision = remote.revision;
      officeBaseData = remote.data;
      const remoteEmpty =
        !remote.data.clients.length && !remote.data.policies.length && !remote.data.pucEntries.length;
      const localHasData = local.clients.length || local.policies.length || local.pucEntries.length;
      // First setup on the main PC: move its existing local data into the new shared database.
      if (remoteEmpty && localHasData) {
        officeRevision = await putOfficeSnapshot(officeUrl, local, remote.revision);
        officeBaseData = local;
        return local;
      }
      return remote.data;
    } catch {
      // Keep the existing local copy usable when the main PC is temporarily unavailable.
      return local;
    }
  }

  if (!window.shopdesk) return local;

  try {
    const fromDisk = await withTimeout(window.shopdesk.loadData(), 1200, null);
    if (fromDisk) return migrateParsed(fromDisk);

    // First desktop run: import browser data if any
    if (local.policies.length || local.clients.length || local.pucEntries.length) {
      void window.shopdesk.saveData(local);
      return local;
    }
    return emptyData();
  } catch {
    return local;
  }
}

export async function saveAppData(data: AppData): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Never overwrite existing shop data with a blank wipe (load/save race)
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    if (existingRaw) {
      const existing = migrateParsed(existingRaw);
      const incomingEmpty =
        !data.policies.length &&
        !data.clients.length &&
        !data.pucEntries.length &&
        !(data.expenses || []).length;
      const existingHasData =
        existing.policies.length > 0 ||
        existing.clients.length > 0 ||
        existing.pucEntries.length > 0 ||
        (existing.expenses || []).length > 0;
      if (incomingEmpty && existingHasData) {
        return false;
      }
    }
  } catch {
    /* continue */
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return false;
  }

  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    officeSaveQueue = officeSaveQueue
      .catch(() => undefined)
      .then(async () => {
        const current = await fetchOfficeSnapshot(officeUrl);
        const base = officeBaseData || current.data;
        const merged = mergeAppData(base, data, current.data);
        try {
          officeRevision = await putOfficeSnapshot(officeUrl, merged, current.revision);
        } catch {
          // Another PC saved after our read. Merge separate records and retry once.
          const latest = await fetchOfficeSnapshot(officeUrl);
          const retried = mergeAppData(base, data, latest.data);
          officeRevision = await putOfficeSnapshot(officeUrl, retried, latest.revision);
          officeBaseData = retried;
          if (!same(retried, data)) {
            window.dispatchEvent(new CustomEvent<AppData>("shopdesk:office-merged", { detail: retried }));
          }
          return;
        }
        officeBaseData = merged;
        if (!same(merged, data)) {
          window.dispatchEvent(new CustomEvent<AppData>("shopdesk:office-merged", { detail: merged }));
        }
      })
      .catch((error) => console.warn("ShopDesk office save failed", error));
    return true;
  }

  if (!window.shopdesk) return true;

  const slim: AppData = {
    ...data,
    policies: data.policies.map((p) => ({
      ...p,
      documents: (p.documents || []).map((d) => ({
        ...d,
        dataUrl: d.fileId ? undefined : d.dataUrl,
      })),
    })),
  };

  try {
    await withTimeout(window.shopdesk.saveData(slim), 2000, false);
  } catch {
    /* ignore disk; browser copy already saved */
  }
  return true;
}

function dataUrlToBase64(dataUrl: string): { base64: string; mime: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid file data");
  return { mime: match[1], base64: match[2] };
}

export async function persistDocumentFile(input: {
  fileId?: string;
  name: string;
  mime: string;
  dataUrl: string;
  clientName?: string;
  type?: string;
}): Promise<string | null> {
  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    if (!input.fileId) return null;
    const { base64, mime } = dataUrlToBase64(input.dataUrl);
    const response = await officeFetch(`/api/v1/documents/${encodeURIComponent(input.fileId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mime: input.mime || mime, name: input.name }),
    });
    if (!response.ok) throw new Error("Could not save document to the office server");
    return input.fileId;
  }
  if (!window.shopdesk) return null;
  const { base64, mime } = dataUrlToBase64(input.dataUrl);
  const result = await withTimeout(
    window.shopdesk.saveDoc({
      fileId: input.fileId,
      base64,
      mime: input.mime || mime,
      name: input.name,
      clientName: input.clientName,
      type: input.type,
    }),
    10000,
    { fileId: input.fileId || "", size: 0 },
  );
  return result.fileId || null;
}

export async function readDocumentPreview(
  fileId: string,
): Promise<string | null> {
  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    try {
      const response = await officeFetch(`/api/v1/documents/${encodeURIComponent(fileId)}`, {}, officeUrl);
      if (response.ok) {
        const doc = (await response.json()) as { mime: string; base64: string };
        return `data:${doc.mime};base64,${doc.base64}`;
      }
    } catch {
      return null;
    }
    // Existing document from the main PC's previous local-only storage: copy it
    // into shared storage the first time the main PC opens it.
    if (window.shopdesk) {
      const legacy = await withTimeout(window.shopdesk.readDoc(fileId), 5000, null);
      if (legacy?.dataUrl) {
        await persistDocumentFile({ fileId, name: legacy.name, mime: legacy.mime, dataUrl: legacy.dataUrl });
        return legacy.dataUrl;
      }
    }
    return null;
  }
  if (!window.shopdesk) return null;
  const doc = await withTimeout(window.shopdesk.readDoc(fileId), 5000, null);
  return doc?.dataUrl || null;
}

export async function removeDocumentFile(fileId: string): Promise<void> {
  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    await officeFetch(`/api/v1/documents/${encodeURIComponent(fileId)}`, { method: "DELETE" }, officeUrl);
    return;
  }
  if (!window.shopdesk) return;
  await withTimeout(window.shopdesk.deleteDoc(fileId), 3000, true);
}
