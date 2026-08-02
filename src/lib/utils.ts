import type { AppData, MastersMap } from "./types";
import { DEFAULT_FORM_FIELDS } from "./formFields";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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
};

export function emptyData(): AppData {
  return {
    clients: [],
    vehicles: [],
    policies: [],
    pucEntries: [],
    expenses: [],
    adjustments: [],
    masters: structuredClone(DEFAULT_MASTERS),
    formFields: structuredClone(DEFAULT_FORM_FIELDS),
  };
}

export const STORAGE_KEY = "insurance-shop-data-v3";
