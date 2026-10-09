import type { AppData, BuiltInDocType, MastersMap } from "./types";
import { DEFAULT_FORM_FIELDS } from "./formFields";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

/** Local calendar date (YYYY-MM-DD), not UTC — date pickers use the shop’s day. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateKey(value?: string | null): string {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

/** Shop display format: ddmmyy, shown as dd/mm/yy. */
export function formatDDMMYY(value?: string | null): string {
  const key = dateKey(value);
  if (!key) return "";
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

export function inDateRange(
  date: string | undefined,
  from?: string,
  to?: string,
): boolean {
  const day = dateKey(date);
  if (!day) return false;
  const start = dateKey(from);
  const end = dateKey(to);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

export function monthRange(offset = 0, now = new Date()): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

/** Disk folder: `suresh2W Policybazar` from customer + variant + policy/portal. */
export function documentFolderName(input: {
  clientName?: string;
  variant?: string;
  vehicleMode?: string;
  portal?: string;
}): string {
  const name = String(input.clientName || "").trim();
  const variant = String(input.variant || input.vehicleMode || "")
    .trim()
    .replace(/\s+/g, "");
  const policy = String(input.portal || "").trim();
  const combined = `${name}${variant}${policy ? ` ${policy}` : ""}`
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return combined || "Unknown Customer";
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export const DEFAULT_MASTERS: MastersMap = {
  portals: [
    { id: "p1", label: "PolicyBazaar" },
    { id: "p2", label: "InsuranceDekho" },
    { id: "p3", label: "Company Portal" },
    { id: "p4", label: "Offline / Direct" },
  ],
  companies: [
    { id: "c1", label: "ICICI Lombard" },
    { id: "c2", label: "Bajaj Allianz" },
    { id: "c3", label: "HDFC Ergo" },
    { id: "c4", label: "Go Digit" },
    { id: "c5", label: "Acko" },
    { id: "c6", label: "New India" },
  ],
  paymentModes: [
    { id: "pm1", label: "Cash" },
    { id: "pm2", label: "UPI" },
    { id: "pm3", label: "Card" },
    { id: "pm4", label: "Bank Transfer" },
    { id: "pm_credit", label: "Credit" },
  ],
  vehicleModes: [
    { id: "vm1", label: "2 Wheeler" },
    { id: "vm2", label: "4 Wheeler" },
    { id: "vm3", label: "Commercial" },
    { id: "vm4", label: "Three Wheeler" },
  ],
  variants: [
    { id: "v1", label: "Petrol" },
    { id: "v2", label: "Diesel" },
    { id: "v3", label: "CNG" },
    { id: "v4", label: "Electric" },
  ],
  payoutTypes: [
    { id: "po1", label: "Net to company" },
    { id: "po2", label: "Gross payout" },
    { id: "po3", label: "Agent payout" },
  ],
  advanceTypes: [
    { id: "adv_insurance", label: "Insurance advance" },
    { id: "adv_endorsement", label: "Endorsement advance" },
    { id: "adv_puc", label: "PUC" },
    { id: "adv_old_portal_po", label: "Old Portal PO" },
    { id: "adv_customer", label: "Customer Advance" },
  ],
};

/** Digits only, capped at 10. A phone is valid only when this is 10 digits. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** Empty when the phone is exactly 10 digits. */
export function phoneError(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return "";
  if (!digits) return "Enter a 10-digit phone number.";
  return `Phone must be 10 digits. You entered ${digits.length}.`;
}

/** A vehicle number must contain a digit. A name made of letters is rejected. */
export function vehicleNumberError(value: string): string {
  const text = value.trim();
  if (!text) return "Enter the vehicle number.";
  if (!/\d/.test(text)) return "Enter the vehicle number, not a name.";
  return "";
}

export function advanceTypeLabel(kind: string): string {
  if (kind === "insurance") return "Insurance advance";
  if (kind === "endorsement") return "Endorsement advance";
  return kind || "Advance";
}

export function ensureCreditPaymentMode(masters: MastersMap): MastersMap {
  const modes = masters.paymentModes || [];
  const withCredit = modes.some((item) => item.label.trim().toLowerCase() === "credit")
    ? masters
    : {
        ...masters,
        paymentModes: [...modes, { id: "pm_credit", label: "Credit" }],
      };
  if (Array.isArray(withCredit.advanceTypes)) {
    const existing = withCredit.advanceTypes;
    const missing = DEFAULT_MASTERS.advanceTypes.filter(
      (item) => !existing.some((current) => current.label.trim().toLowerCase() === item.label.trim().toLowerCase()),
    );
    return missing.length ? { ...withCredit, advanceTypes: [...existing, ...structuredClone(missing)] } : withCredit;
  }
  return {
    ...withCredit,
    advanceTypes: structuredClone(DEFAULT_MASTERS.advanceTypes),
  };
}

export const BUILTIN_DOC_TYPES: BuiltInDocType[] = [
  "rc",
  "old_insurance",
  "aadhaar",
  "pan",
  "fresh_policy",
];

export const DEFAULT_DOCUMENT_LABELS: Record<BuiltInDocType, string> = {
  rc: "RC",
  old_insurance: "PYP",
  aadhaar: "Aadhaar",
  pan: "Policy",
  fresh_policy: "New fresh policy",
};

export function documentLabel(labels: Partial<Record<BuiltInDocType, string>> | undefined, type: BuiltInDocType): string {
  const value = labels?.[type];
  return value && value.trim() ? value.trim() : DEFAULT_DOCUMENT_LABELS[type];
}

export function emptyData(): AppData {
  return {
    clients: [],
    vehicles: [],
    policies: [],
    pucEntries: [],
    expenses: [],
    adjustments: [],
    portalReceipts: [],
    cashOpenings: [],
    openingEntries: [],
    advances: [],
    masters: structuredClone(DEFAULT_MASTERS),
    formFields: structuredClone(DEFAULT_FORM_FIELDS),
    deletedPolicyIds: [],
    documentLabels: structuredClone(DEFAULT_DOCUMENT_LABELS),
  };
}

export const STORAGE_KEY = "insurance-shop-data-v3";
