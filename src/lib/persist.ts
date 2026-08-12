import type { AppData } from "./types";
import { emptyData, STORAGE_KEY } from "./utils";
import { mergeFormFields } from "./formFields";

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
};

declare global {
  interface Window {
    shopdesk?: ShopdeskBridge;
  }
}

export function isOfflineDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.shopdesk?.isOfflineApp);
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
  if (!window.shopdesk) return null;
  const doc = await withTimeout(window.shopdesk.readDoc(fileId), 5000, null);
  return doc?.dataUrl || null;
}

export async function removeDocumentFile(fileId: string): Promise<void> {
  if (!window.shopdesk) return;
  await withTimeout(window.shopdesk.deleteDoc(fileId), 3000, true);
}
