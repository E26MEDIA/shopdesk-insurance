export type MasterType =
  | "portals"
  | "companies"
  | "paymentModes"
  | "vehicleModes"
  | "variants"
  | "payoutTypes";

export type DocType = "rc" | "old_insurance" | "aadhaar" | "pan" | "other";

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
  /** Custom title when type is "other" (named extra document). */
  label?: string;
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

export type ProfitFields = Pick<
  Policy,
  | "netPremium"
  | "companyOfferPercent"
  | "companyOffer"
  | "tdsPercent"
  | "points"
  | "received"
  | "payment"
>;

export function offerPercent(
  p: Pick<Policy, "companyOfferPercent" | "companyOffer">,
): number {
  if (typeof p.companyOfferPercent === "number" && p.companyOfferPercent > 0) {
    return p.companyOfferPercent;
  }
  if (typeof p.companyOffer === "number" && p.companyOffer > 0 && p.companyOffer <= 100) {
    return p.companyOffer;
  }
  return 0;
}

/**
 * Percent-offer path: net premium × company offer %.
 * Direct-profit path: company gives a rupee amount in Points (no net premium / %).
 */
export function usesPointsProfit(p: ProfitFields): boolean {
  const hasPercentOffer = (p.netPremium || 0) > 0 && offerPercent(p) > 0;
  return !hasPercentOffer && (p.points || 0) > 0;
}

/**
 * Example (percent): net premium 5000, company offer 50%
 * company profit = 2500
 * TDS 2% of 2500 = 50
 * then discount 500
 * estimated total profit = 1950
 *
 * Example (points): company gives 500 direct profit, TDS 2%
 * TDS = 10, then discount, profit = 490 − discount
 */
export function offerAmount(p: Pick<Policy, "netPremium" | "companyOfferPercent" | "companyOffer">): number {
  return ((p.netPremium || 0) * offerPercent(p)) / 100;
}

/**
 * Amount the customer still owes when they paid only part of the company payout
 * (credit / half-balance left with the shop).
 */
export function customerBalanceDue(p: Pick<Policy, "received" | "payment">): number {
  return Math.max(0, (p.payment || 0) - (p.received || 0));
}

export function extraPaidAmount(p: Pick<Policy, "received" | "payment">): number {
  return customerBalanceDue(p);
}

/** Company offer profit, or direct points — TDS % is taken from this, then discount. */
export function companyProfitAmount(p: ProfitFields): number {
  if (usesPointsProfit(p)) return p.points || 0;
  return offerAmount(p);
}

/** TDS % of company profit (before discount). */
export function tdsAmount(p: ProfitFields): number {
  const rate = typeof p.tdsPercent === "number" ? p.tdsPercent : 2;
  const base = Math.max(0, companyProfitAmount(p));
  return (base * (rate || 0)) / 100;
}

export function policyProfit(p: Policy): number {
  return companyProfitAmount(p) - tdsAmount(p) - extraPaidAmount(p);
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

export type ExpenseCategory = "house" | "office";

/** Shop expense entry — choose + or − vs total profit */
export interface Expense {
  id: string;
  date: string;
  amount: number;
  /** "-" subtracts from profit (default), "+" adds */
  sign: "+" | "-";
  description: string;
  /** House vs office. Existing records without this are treated as office. */
  category: ExpenseCategory;
  createdAt: string;
}

export function expenseCategory(e: Pick<Expense, "category">): ExpenseCategory {
  return e.category === "house" ? "house" : "office";
}

export function expenseSignedAmount(e: Pick<Expense, "amount" | "sign">): number {
  const n = e.amount || 0;
  return (e.sign || "-") === "+" ? n : -n;
}

export function expenseNet(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + expenseSignedAmount(e), 0);
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
  /** Policy ids removed on this or another office PC — keeps deletes from coming back. */
  deletedPolicyIds?: string[];
}
