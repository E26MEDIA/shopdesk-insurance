export type MasterType =
  | "portals"
  | "companies"
  | "paymentModes"
  | "vehicleModes"
  | "variants"
  | "payoutTypes";

export type DocType = "rc" | "old_insurance" | "aadhaar" | "pan";

export type FormFieldType =
  | "text"
  | "date"
  | "number"
  | "select"
  | "textarea"
  | "money"
  | "percent";

export interface MasterItem {
  id: string;
  label: string;
}

/** One column/field on the insurance form — configured in Admin */
export interface FormFieldDef {
  id: string;
  /** Built-in Policy key, or custom_* for user-added fields */
  key: string;
  label: string;
  type: FormFieldType;
  enabled: boolean;
  required: boolean;
  /** Cannot hide/remove (client name, reg no, date) */
  locked?: boolean;
  /** Dropdown options come from this master list */
  masterType?: MasterType;
  /** User-created extra column */
  custom?: boolean;
  order: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  clientId: string;
  regNo: string;
  mode: string;
  variant: string;
  rcNumber: string;
  contact: string;
  createdAt: string;
}

export interface DocumentMeta {
  id: string;
  type: DocType;
  name: string;
  mime: string;
  /** Browser / preview cache. In offline desktop, files also live on disk via fileId. */
  dataUrl?: string;
  /** Offline desktop disk id under app data folder */
  fileId?: string;
  uploadedAt: string;
}

/** One part of the amount received from a customer (e.g. Cash + UPI). */
export interface CustomerPayment {
  id: string;
  mode: string;
  amount: number;
}

/** Insurance row — all customer/vehicle details typed by staff each time */
export interface Policy {
  id: string;
  clientName: string;
  phone: string;
  contact: string;
  regNo: string;
  rcNumber: string;
  date: string;
  description: string;
  /** Money received from customer */
  received: number;
  /** Money we pay to company */
  payment: number;
  expiryDate: string;
  /** Extra we paid vs customer (auto: max(0, payment − received)) — kept for display */
  discount: number;
  payoutType: string;
  vehicleMode: string;
  variant: string;
  portal: string;
  company: string;
  paymentMode: string;
  /** Non-cash reward/portal points earned for this policy. */
  points: number;
  /** Optional split of received amount across Cash, UPI, Card, etc. */
  customerPayments: CustomerPayment[];
  renewal: boolean;
  paid: boolean;
  /** Company offer % from portal (e.g. 7) */
  companyOfferPercent: number;
  /** TDS deducted from net premium; default 2%, configurable per policy. */
  tdsPercent: number;
  /** @deprecated use companyOfferPercent */
  companyOffer?: number;
  netPremium: number;
  pendingNotes: string;
  documents: DocumentMeta[];
  /** Values for Admin-added custom columns */
  customFields: Record<string, string>;
  /** After save, staff must confirm; can still edit later */
  confirmed: boolean;
  createdAt: string;
}

/**
 * Example: customer 10500, pay company 10700, net premium 9800, offer 7%
 * offerAmt = 9800 * 7% = 686
 * extraPaid = 10700 - 10500 = 200
 * TDS = 2% of net premium = 196 (or the policy's configured rate)
 * profit = 686 - 200 - 196 = 290
 * i.e. profit = (netPremium * %) + (received − payment) − TDS
 */
export function offerAmount(p: Pick<Policy, "netPremium" | "companyOfferPercent" | "companyOffer">): number {
  const pct =
    p.companyOfferPercent ??
    (typeof p.companyOffer === "number" && p.companyOffer <= 100
      ? p.companyOffer
      : 0);
  return ((p.netPremium || 0) * (pct || 0)) / 100;
}

/** TDS deducted from insurance profit: 2% of the company net premium. */
export function tdsAmount(p: Pick<Policy, "netPremium" | "tdsPercent">): number {
  const rate = typeof p.tdsPercent === "number" ? p.tdsPercent : 2;
  return ((p.netPremium || 0) * (rate || 0)) / 100;
}

export function policyProfit(p: Policy): number {
  return offerAmount(p) + (p.received || 0) - (p.payment || 0) - tdsAmount(p);
}

export function blankPolicy(): Omit<Policy, "id" | "createdAt"> {
  return {
    clientName: "",
    phone: "",
    contact: "",
    regNo: "",
    rcNumber: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    received: 0,
    payment: 0,
    expiryDate: "",
    discount: 0,
    payoutType: "",
    vehicleMode: "",
    variant: "",
    portal: "",
    company: "",
    paymentMode: "",
    points: 0,
    customerPayments: [],
    renewal: false,
    paid: false,
    companyOfferPercent: 0,
    tdsPercent: 2,
    companyOffer: 0,
    netPremium: 0,
    pendingNotes: "",
    documents: [],
    customFields: {},
    confirmed: false,
  };
}

export interface PucEntry {
  id: string;
  date: string;
  clientName: string;
  regNo: string;
  vehicleMode: string;
  amount: number;
  notes: string;
  createdAt: string;
}

/** Shop expense entry — choose + or − vs total profit */
export interface Expense {
  id: string;
  date: string;
  amount: number;
  /** "-" subtracts from profit (default), "+" adds */
  sign: "+" | "-";
  description: string;
  createdAt: string;
}

/** Manual +/- adjustment with description */
export interface Adjustment {
  id: string;
  date: string;
  amount: number;
  sign: "+" | "-";
  description: string;
  createdAt: string;
}

export type MastersMap = Record<MasterType, MasterItem[]>;

export interface AppData {
  clients: Client[];
  vehicles: Vehicle[];
  policies: Policy[];
  pucEntries: PucEntry[];
  expenses: Expense[];
  adjustments: Adjustment[];
  masters: MastersMap;
  /** Insurance form columns — rename / hide / add from Admin */
  formFields: FormFieldDef[];
}
