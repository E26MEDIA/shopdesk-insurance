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
let officeDocSyncQueue: Promise<{ downloaded: number; uploaded: number }> = Promise.resolve({ downloaded: 0, uploaded: 0 });
let lastOfficeDocSync = 0;

export type OfficeProbeResult = {
  ok: boolean;
  url?: string;
  urls?: string[];
  port?: number;
  error?: string;
};

export type OfficeServerMatch = {
  url: string;
  urls?: string[];
  port?: number;
};

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
  recoverDocuments?: (data: AppData) => Promise<{ copied: number }>;
  listDocs?: () => Promise<{ fileId: string; name: string; size: number }[]>;
  docStat?: (fileId: string) => Promise<{ fileId: string; size: number; path?: string } | null>;
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
    port?: number;
    urls?: string[];
    addresses?: string[];
    firewallOpened?: boolean;
    localUrl?: string;
  }>;
  getOfficeLanInfo?: () => Promise<{
    port: number;
    discoverPort?: number;
    addresses: string[];
    urls: string[];
  }>;
  probeOfficeServer?: (url: string) => Promise<OfficeProbeResult>;
  discoverOfficeServers?: () => Promise<OfficeServerMatch[]>;
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

export function normalizeOfficeServerUrl(raw: string, defaultPort = 3457): string {
  let value = raw.trim().replace(/\/$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname) return "";
    if (!url.port) url.port = String(defaultPort);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return "";
  }
}

export function isLoopbackOfficeUrl(raw: string): boolean {
  const normalized = normalizeOfficeServerUrl(raw);
  let hostname = "";
  try {
    hostname = new URL(normalized || raw).hostname.toLowerCase();
  } catch {
    return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/i.test(raw);
  }
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function setOfficeServerUrl(value: string): void {
  const normalized = normalizeOfficeServerUrl(value);
  if (!normalized) localStorage.removeItem(OFFICE_SERVER_KEY);
  else localStorage.setItem(OFFICE_SERVER_KEY, normalized);
  officeRevision = null;
  officeBaseData = null;
}

export async function checkOfficeServer(url: string): Promise<OfficeProbeResult> {
  const address = normalizeOfficeServerUrl(url);
  if (!address) {
    return { ok: false, error: "Enter an address like 192.168.1.50 or http://192.168.1.50:3457" };
  }
  if (window.shopdesk?.probeOfficeServer) {
    return window.shopdesk.probeOfficeServer(address);
  }
  try {
    const response = await fetch(`${address}/health`);
    const body = (await response.json()) as { ok?: boolean; urls?: string[]; port?: number };
    if (response.ok && body.ok === true) {
      return { ok: true, url: address, urls: body.urls, port: body.port };
    }
    return { ok: false, error: "Office Server did not respond correctly" };
  } catch {
    if (isLoopbackOfficeUrl(address)) {
      return {
        ok: false,
        error: "localhost only works on the main PC. On this laptop, type the Wi-Fi address shown on the main PC Admin page, for example http://192.168.1.50:3457.",
      };
    }
    return {
      ok: false,
      error: `Cannot reach ${address}. Check the main PC address, that Office Server is running, and Windows Firewall on the main PC.`,
    };
  }
}

export async function discoverOfficeServers(): Promise<OfficeServerMatch[]> {
  if (window.shopdesk?.discoverOfficeServers) {
    return window.shopdesk.discoverOfficeServers();
  }
  return [];
}

export async function getOfficeLanInfo(): Promise<{ port: number; addresses: string[]; urls: string[] } | null> {
  if (!window.shopdesk?.getOfficeLanInfo) return null;
  return window.shopdesk.getOfficeLanInfo();
}

export type OfficeStatus = {
  ok: boolean;
  startedAt: string;
  port: number;
  backupHour: number;
  urls?: string[];
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
    if (Date.now() - lastOfficeDocSync > 8000) {
      lastOfficeDocSync = Date.now();
      void syncOfficeDocuments().catch(() => undefined);
    }
    const remote = await fetchOfficeSnapshot(url);
    if (remote.revision === officeRevision) return null;
    officeRevision = remote.revision;
    officeBaseData = remote.data;
    lastOfficeDocSync = Date.now();
    void syncOfficeDocuments().catch(() => undefined);
    return remote.data;
  } catch {
    return null;
  }
}

type OfficeDocListItem = { fileId: string; name: string; size: number; updatedAt?: string };

export async function syncOfficeDocuments(): Promise<{ downloaded: number; uploaded: number }> {
  const run = officeDocSyncQueue.catch(() => ({ downloaded: 0, uploaded: 0 })).then(async () => {
    const url = getOfficeServerUrl();
    if (!url || !window.shopdesk?.saveDoc) return { downloaded: 0, uploaded: 0 };
    const listed = await officeFetch("/api/v1/documents", { cache: "no-store" }, url);
    if (!listed.ok) return { downloaded: 0, uploaded: 0 };
    const remoteFiles = ((await listed.json()) as { files?: OfficeDocListItem[] }).files || [];
    const remoteIds = new Set(remoteFiles.map((file) => file.fileId));
    let uploaded = 0;
    const localFiles = window.shopdesk.listDocs ? await window.shopdesk.listDocs() : [];
    for (const local of localFiles) {
      if (remoteIds.has(local.fileId)) continue;
      const doc = await withTimeout(window.shopdesk.readDoc(local.fileId), 8000, null);
      if (!doc?.dataUrl) continue;
      try {
        await persistDocumentFile({
          fileId: local.fileId,
          name: doc.name || local.name,
          mime: doc.mime,
          dataUrl: doc.dataUrl,
        });
        remoteIds.add(local.fileId);
        uploaded += 1;
      } catch {
        /* keep other files moving */
      }
    }
    let downloaded = 0;
    for (const file of remoteFiles) {
      const local = window.shopdesk.docStat ? await window.shopdesk.docStat(file.fileId) : null;
      if (local && local.size === file.size) continue;
      try {
        const response = await officeFetch(`/api/v1/documents/${encodeURIComponent(file.fileId)}`, {}, url);
        if (!response.ok) continue;
        const doc = (await response.json()) as { name?: string; mime?: string; base64?: string };
        if (!doc.base64) continue;
        await window.shopdesk.saveDoc({
          fileId: file.fileId,
          base64: doc.base64,
          mime: doc.mime || "application/octet-stream",
          name: doc.name || file.name,
        });
        downloaded += 1;
      } catch {
        /* keep other files moving */
      }
    }
    return { downloaded, uploaded };
  });
  officeDocSyncQueue = run;
  return run;
}

export async function openSharedDataFolder(): Promise<void> {
  if (getOfficeServerUrl()) {
    await syncOfficeDocuments().catch(() => undefined);
  }
  if (window.shopdesk?.openDataFolder) {
    await window.shopdesk.openDataFolder();
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
  port?: number;
  urls?: string[];
  addresses?: string[];
  firewallOpened?: boolean;
  localUrl?: string;
}> {
  if (!window.shopdesk?.startOfficeServer) throw new Error("Open the installed ShopDesk desktop app first");
  return window.shopdesk.startOfficeServer();
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

function recordCount(data: AppData): number {
  return data.clients.length + data.policies.length + data.pucEntries.length;
}

async function localDesktopData(localStorageData: AppData): Promise<AppData> {
  if (!window.shopdesk) return localStorageData;
  const fromDisk = await withTimeout(window.shopdesk.loadData(), 2000, null);
  if (!fromDisk) return localStorageData;
  return mergeAppData(emptyData(), localStorageData, migrateParsed(fromDisk));
}

async function migrateLocalDocumentsToOffice(data: AppData): Promise<void> {
  if (!getOfficeServerUrl()) return;
  if (window.shopdesk?.recoverDocuments) {
    await withTimeout(window.shopdesk.recoverDocuments(data), 8000, { copied: 0 });
  }
  if (!window.shopdesk?.readDoc) return;
  for (const policy of data.policies || []) {
    for (const doc of policy.documents || []) {
      if (!doc.fileId) continue;
      try {
        const existing = await officeFetch(`/api/v1/documents/${encodeURIComponent(doc.fileId)}`);
        if (existing.ok) continue;
        const legacy = await withTimeout(window.shopdesk.readDoc(doc.fileId), 5000, null);
        if (!legacy?.dataUrl) continue;
        await persistDocumentFile({
          fileId: doc.fileId,
          name: legacy.name || doc.name,
          mime: legacy.mime || doc.mime,
          dataUrl: legacy.dataUrl,
          clientName: policy.clientName,
          type: doc.type,
        });
      } catch {
        /* keep going so one missing file does not block the rest */
      }
    }
  }
}

export async function loadAppData(): Promise<AppData> {
  if (typeof window === "undefined") return emptyData();

  const localStorageData = loadFromLocalStorage();
  const local = await localDesktopData(localStorageData);

  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    try {
      const remote = await fetchOfficeSnapshot(officeUrl);
      officeRevision = remote.revision;
      officeBaseData = remote.data;
      const localHasData = recordCount(local) > 0;
      const shouldImportLocal = localHasData && (
        recordCount(remote.data) === 0
        || (isLoopbackOfficeUrl(officeUrl) && recordCount(local) > recordCount(remote.data))
      );
      if (shouldImportLocal) {
        const merged = mergeAppData(remote.data, local, remote.data);
        if (!same(merged, remote.data)) {
          try {
            officeRevision = await putOfficeSnapshot(officeUrl, merged, remote.revision);
            officeBaseData = merged;
          } catch {
            officeBaseData = remote.data;
            await migrateLocalDocumentsToOffice(remote.data);
            await syncOfficeDocuments();
            return remote.data;
          }
          await migrateLocalDocumentsToOffice(merged);
          await syncOfficeDocuments();
          return merged;
        }
      }
      await migrateLocalDocumentsToOffice(remote.data);
      await syncOfficeDocuments();
      return remote.data;
    } catch {
      if (window.shopdesk?.recoverDocuments) {
        void window.shopdesk.recoverDocuments(local);
      }
      return local;
    }
  }

  if (window.shopdesk && recordCount(local) > 0) {
    void window.shopdesk.saveData(local);
  }
  if (window.shopdesk?.recoverDocuments) {
    void window.shopdesk.recoverDocuments(local);
  }
  return local;
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
  const { base64, mime } = dataUrlToBase64(input.dataUrl);
  let savedId = input.fileId || null;
  if (window.shopdesk) {
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
    savedId = result.fileId || savedId;
  }
  const officeUrl = getOfficeServerUrl();
  if (officeUrl) {
    if (!savedId) return null;
    const response = await officeFetch(`/api/v1/documents/${encodeURIComponent(savedId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64,
        mime: input.mime || mime,
        name: input.name,
        clientName: input.clientName,
      }),
    });
    if (!response.ok) throw new Error("Could not save document to the office server");
    return savedId;
  }
  if (!window.shopdesk) return null;
  return savedId;
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
      /* Fall through to the files still on this PC. */
    }
    if (window.shopdesk) {
      const legacy = await withTimeout(window.shopdesk.readDoc(fileId), 5000, null);
      if (legacy?.dataUrl) {
        void persistDocumentFile({ fileId, name: legacy.name, mime: legacy.mime, dataUrl: legacy.dataUrl });
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
  }
  if (!window.shopdesk) return;
  await withTimeout(window.shopdesk.deleteDoc(fileId), 3000, true);
}
