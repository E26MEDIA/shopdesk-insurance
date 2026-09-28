export type MasterType =
  | "portals"
  | "companies"
  | "paymentModes"
  | "vehicleModes"
  | "variants"
  | "payoutTypes";

export type DocType = "rc" | "old_insurance" | "aadhaar" | "pan" | "fresh_policy" | "other";

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

export const CREDIT_MODE = "Credit";

export function isCreditPayment(mode?: string): boolean {
  return String(mode || "").trim().toLowerCase() === "credit";
}

function paymentSum(
  parts: CustomerPayment[] | undefined,
  predicate?: (part: CustomerPayment) => boolean,
): number {
  return (parts || []).reduce((sum, part) => {
    if (!part.amount) return sum;
    if (predicate && !predicate(part)) return sum;
    return sum + part.amount;
  }, 0);
}

/** One part of the amount received from a customer (e.g. Cash + UPI + Credit). */
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
  /** How much the customer has to pay us (customer-side bill). */
  customerSidePayment: number;
  /** Cash actually received from the customer (not credit). */
  received: number;
  /** Money we pay to the insurance company — not customer credit. */
  payment: number;
  expiryDate: string;
  /** Extra we paid the company vs the customer bill (auto: max(0, payment − customer side)) */
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
  /** Company offer % from portal (e.g. 7 or 4.5). */
  companyOfferPercent: number;
  /** TDS deducted from company profit; default 2%, decimals allowed. */
  tdsPercent: number;
  /**
   * Small extra charge taken from the customer.
   * Added only to the last total profit — not to estimated portal profit.
   */
  insExtraPo: number;
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
  | "customerSidePayment"
  | "customerPayments"
  | "insExtraPo"
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
/** Rupees to paise, so 4.5% offers do not drift. */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function offerAmount(p: Pick<Policy, "netPremium" | "companyOfferPercent" | "companyOffer">): number {
  return roundMoney(((p.netPremium || 0) * offerPercent(p)) / 100);
}

/** What the customer is supposed to pay us. */
export function customerBill(
  p: Pick<Policy, "customerSidePayment" | "received" | "customerPayments">,
): number {
  if ((p.customerSidePayment || 0) > 0) return p.customerSidePayment || 0;
  const splitTotal = paymentSum(p.customerPayments);
  if (splitTotal > 0) return splitTotal;
  return p.received || 0;
}

/** Cash/UPI/etc actually collected — Credit lines are not included. */
export function collectedFromCustomer(
  p: Pick<Policy, "received" | "customerPayments">,
): number {
  const parts = p.customerPayments || [];
  if (parts.length) {
    return paymentSum(parts, (part) => !isCreditPayment(part.mode));
  }
  return p.received || 0;
}

/**
 * Unpaid customer credit: customer-side bill minus cash/UPI/card collected.
 * Credit is recorded as a payment method in the received split.
 * This is not “we pay company − received”.
 */
export function customerCredit(
  p: Pick<Policy, "customerSidePayment" | "received" | "customerPayments">,
): number {
  const named = paymentSum(p.customerPayments, (part) => isCreditPayment(part.mode));
  const leftover = Math.max(0, customerBill(p) - collectedFromCustomer(p));
  return Math.max(named, leftover);
}

export function customerBalanceDue(
  p: Pick<Policy, "customerSidePayment" | "received" | "customerPayments">,
): number {
  return customerCredit(p);
}

export function extraPaidAmount(
  p: Pick<Policy, "received" | "payment" | "customerSidePayment" | "customerPayments">,
): number {
  return Math.max(0, (p.payment || 0) - customerBill(p));
}

/** Company offer profit, or direct points. TDS is taken from this. Discount is not. */
export function companyProfitAmount(p: ProfitFields): number {
  if (usesPointsProfit(p)) return p.points || 0;
  return offerAmount(p);
}

/** TDS % of company profit (before discount). */
export function tdsAmount(p: ProfitFields): number {
  const rate = typeof p.tdsPercent === "number" ? p.tdsPercent : 2;
  const base = Math.max(0, companyProfitAmount(p));
  return roundMoney((base * (rate || 0)) / 100);
}

/** Gross payout from the portal/company (offer amount or direct points), before TDS. */
export function companyPayoutAmount(p: ProfitFields): number {
  return roundMoney(companyProfitAmount(p));
}

/**
 * Estimated profit — money the portal offers.
 * Company payout (net premium × % or direct points) − TDS.
 * Discount is not deducted. Ins Extra PO is not included.
 */
export function policyProfit(p: Policy): number {
  return roundMoney(companyProfitAmount(p) - tdsAmount(p));
}

/**
 * Extra kept from the customer after paying the company.
 * Customer 970 and we pay company 950 → 20. Null when either amount is still blank.
 */
export function autoInsExtraPo(customerSide: number, wePayCompany: number): number | null {
  if (!(customerSide > 0) || !(wePayCompany > 0)) return null;
  return roundMoney(Math.max(0, customerSide - wePayCompany));
}

export function insExtraPoAmount(p: Pick<Policy, "insExtraPo"> | { insExtraPo?: number }): number {
  return roundMoney(Math.max(0, p.insExtraPo || 0));
}

/** Last total profit on the row: estimated portal profit + Ins Extra PO. */
export function totalProfitWithExtra(p: Policy): number {
  return roundMoney(policyProfit(p) + insExtraPoAmount(p));
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
    customerSidePayment: 0,
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
    insExtraPo: 0,
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

export type ExpenseCategory = "house" | "office" | "puc";

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
  if (e.category === "house" || e.category === "puc") return e.category;
  return "office";
}

export function expenseSignedAmount(e: Pick<Expense, "amount" | "sign">): number {
  const n = e.amount || 0;
  return (e.sign || "-") === "+" ? n : -n;
}

export function expenseNet(expenses: Expense[]): number {
  return roundMoney(expenses.reduce((s, e) => s + expenseSignedAmount(e), 0));
}

/** Money received from a portal against its payout (PO). */
export interface PortalReceipt {
  id: string;
  date: string;
  /** Portal name, e.g. Mint. Falls back to company when the entry has no portal. */
  portal: string;
  amount: number;
  notes: string;
  createdAt: string;
}

/** Regular investment or payout added into that day's opening balance. */
export interface OpeningEntry {
  id: string;
  date: string;
  kind: "investment" | "payout";
  amount: number;
  description: string;
  createdAt: string;
}

/** Advance collected before the insurance is entered. */
export interface Advance {
  id: string;
  date: string;
  kind: "insurance" | "endorsement";
  regNo: string;
  phone: string;
  description: string;
  amount: number;
  createdAt: string;
}

/** Opening cash at the start of a date, before that day's profit and payments. */
export interface CashOpening {
  id: string;
  date: string;
  amount: number;
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
  /** Lump sums received from a portal against estimated payout. */
  portalReceipts: PortalReceipt[];
  /** Manual opening balances. Later days carry the previous closing. */
  cashOpenings: CashOpening[];
  /** Investments and regular payouts added to the opening balance. */
  openingEntries: OpeningEntry[];
  /** Insurance and endorsement advances. */
  advances: Advance[];
  masters: MastersMap;
  /** Insurance form columns — rename / hide / add from Admin */
  formFields: FormFieldDef[];
  /** Policy ids removed on this or another office PC — keeps deletes from coming back. */
  deletedPolicyIds?: string[];
}
