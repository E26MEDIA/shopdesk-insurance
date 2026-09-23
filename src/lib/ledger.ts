import {
  companyPayoutAmount,
  customerCredit,
  expenseCategory,
  expenseNet,
  extraPaidAmount,
  insExtraPoAmount,
  offerPercent,
  policyProfit,
  roundMoney,
  tdsAmount,
  totalProfitWithExtra,
  type AppData,
  type CashOpening,
  type Expense,
  type Policy,
  type PortalReceipt,
} from "./types";
import { dateKey, inDateRange } from "./utils";

export type PortalPoRow = {
  name: string;
  kind: "Portal" | "Company";
  companies: string[];
  policies: number;
  toCome: number;
  received: number;
  pending: number;
};

/** One insurance product on a portal, with the amounts that go into the Excel file. */
export type PortalProduct = {
  id: string;
  portal: string;
  date: string;
  party: string;
  regNo: string;
  company: string;
  netPremium: number;
  offerPercent: number;
  payout: number;
  tds: number;
  discount: number;
  estimated: number;
  insExtra: number;
  totalProfit: number;
  confirmed: boolean;
};

export type CashPosition = {
  opening: number;
  /** True when this date has a saved opening, not a carried closing. */
  openingIsSet: boolean;
  estimatedProfit: number;
  insExtra: number;
  totalProfit: number;
  companyPay: number;
  house: number;
  office: number;
  pucIncome: number;
  closing: number;
};

export type SheetRow = {
  issuedDate: string;
  party: string;
  received: number;
  paidToCompany: number;
  payout: number;
  tds: number;
  discount: number;
  house: number;
  shop: number;
  insExtra: number;
  totalProfit: number;
  balance: number;
  balanceReceived: number;
  poReceived: number;
  openClose: number | "";
  regNo: string;
  model: string;
  variant: string;
  rcOwner: string;
  contact: string;
  portal: string;
  company: string;
  expiry: string;
  netPremium: number;
  offerPercent: number | "";
  estimatedProfit: number;
};

export const REPORT_HEADERS = [
  "ISSUED Date",
  "PARTY",
  "Received from party",
  "Paid to company",
  "PAYOUT",
  "TDS",
  "DISCOUNT",
  "HSE EXP",
  "SH EXP",
  "Ins Extra PO",
  "TOTAL PROFIT",
  "BALANCE AMT",
  "BL AMT RCVD",
  "PO RCVD FROM CO",
  "OPEN/CLOS AMT",
  "REG NO",
  "MODEL",
  "VARIENT",
  "RC Owner",
  "CONTACT No",
  "PORTAL",
  "Company",
  "EXPIRY DATE",
  "Net premium",
  "Company offer %",
  "Estimated profit",
] as const;

function addDays(iso: string, days: number): string {
  const day = dateKey(iso);
  if (!day) return "";
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eachDate(from: string, to: string): string[] {
  const start = dateKey(from);
  const end = dateKey(to);
  if (!start || !end || start > end) return [];
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function portalGroupName(input: { portal?: string; company?: string }): {
  name: string;
  kind: "Portal" | "Company";
} {
  const portal = String(input.portal || "").trim();
  if (portal) return { name: portal, kind: "Portal" };
  const company = String(input.company || "").trim();
  if (company) return { name: company, kind: "Company" };
  return { name: "Unassigned", kind: "Company" };
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

type Bucket = PortalPoRow;

function bucketFor(
  map: Map<string, Bucket>,
  name: string,
  kind: "Portal" | "Company",
): Bucket {
  const key = name.trim().toLowerCase();
  const existing = map.get(key);
  if (existing) {
    if (kind === "Portal") existing.kind = "Portal";
    return existing;
  }
  const created: Bucket = {
    name: name.trim(),
    kind,
    companies: [],
    policies: 0,
    toCome: 0,
    received: 0,
    pending: 0,
  };
  map.set(key, created);
  return created;
}

export function portalProductFromPolicy(policy: Policy): PortalProduct {
  const group = portalGroupName(policy);
  return {
    id: policy.id,
    portal: group.name,
    date: policy.date || "",
    party: policy.clientName || "",
    regNo: policy.regNo || "",
    company: policy.company || "",
    netPremium: policy.netPremium || 0,
    offerPercent: offerPercent(policy),
    payout: companyPayoutAmount(policy),
    tds: tdsAmount(policy),
    discount: extraPaidAmount(policy),
    estimated: policyProfit(policy),
    insExtra: insExtraPoAmount(policy),
    totalProfit: totalProfitWithExtra(policy),
    confirmed: Boolean(policy.confirmed),
  };
}

/** Company-offer insurance dated on or before `to`, newest first. Points-only rows are left out. */
export function portalProducts(
  data: Pick<AppData, "policies">,
  to?: string,
): PortalProduct[] {
  const end = dateKey(to);
  return (data.policies || [])
    .filter((policy) => hasCompanyOfferPercent(policy))
    .filter((policy) => !end || !dateKey(policy.date) || dateKey(policy.date) <= end)
    .map(portalProductFromPolicy)
    .sort((a, b) => a.portal.localeCompare(b.portal) || b.date.localeCompare(a.date) || a.party.localeCompare(b.party));
}

/** True when this insurance earns portal money from a company offer %, not from direct points. */
export function hasCompanyOfferPercent(policy: Pick<Policy, "netPremium" | "companyOfferPercent" | "companyOffer">): boolean {
  return offerPercent(policy) > 0;
}

/**
 * One row for every portal in Admin, plus any portal named on an insurance.
 * A new portal shows here before its first customer.
 * Earning is that portal’s estimated profit: company offer % only
 * (net premium × offer % − TDS − discount). Direct points and Ins Extra PO
 * are not added to the portal amount.
 */
export function portalPoRows(data: Pick<AppData, "policies" | "portalReceipts" | "masters">, to: string): PortalPoRow[] {
  const end = dateKey(to);
  const map = new Map<string, Bucket>();

  for (const portal of data.masters?.portals || []) {
    if (portal.label.trim()) bucketFor(map, portal.label, "Portal");
  }

  for (const policy of data.policies || []) {
    if (end && dateKey(policy.date) > end) continue;
    if (!hasCompanyOfferPercent(policy)) continue;
    const group = portalGroupName(policy);
    const row = bucketFor(map, group.name, group.kind);
    row.policies += 1;
    row.toCome = roundMoney(row.toCome + policyProfit(policy));
    const company = String(policy.company || "").trim();
    if (company && !row.companies.some((item) => sameName(item, company)) && !sameName(company, row.name)) {
      row.companies.push(company);
    }
  }

  for (const receipt of data.portalReceipts || []) {
    if (end && dateKey(receipt.date) > end) continue;
    const name = String(receipt.portal || "").trim();
    if (!name) continue;
    const row = bucketFor(map, name, "Portal");
    row.received = roundMoney(row.received + (receipt.amount || 0));
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      companies: [...row.companies].sort((a, b) => a.localeCompare(b)),
      pending: roundMoney(row.toCome - row.received),
    }))
    .sort((a, b) => {
      const activeA = a.toCome !== 0 || a.received !== 0 ? 1 : 0;
      const activeB = b.toCome !== 0 || b.received !== 0 ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;
      if (b.pending !== a.pending) return b.pending - a.pending;
      return a.name.localeCompare(b.name);
    });
}

function dayMovement(data: AppData, day: string) {
  const policies = (data.policies || []).filter((policy) => dateKey(policy.date) === day);
  const expenses = (data.expenses || []).filter((expense) => dateKey(expense.date) === day);
  const house = expenses.filter((expense) => expenseCategory(expense) === "house");
  const office = expenses.filter((expense) => expenseCategory(expense) === "office");
  return {
    totalProfit: roundMoney(policies.reduce((sum, policy) => sum + totalProfitWithExtra(policy), 0)),
    companyPay: roundMoney(policies.reduce((sum, policy) => sum + (policy.payment || 0), 0)),
    house: expenseNet(house),
    office: expenseNet(office),
  };
}

function applyMovement(opening: number, movement: ReturnType<typeof dayMovement>): number {
  return roundMoney(opening + movement.totalProfit + movement.house + movement.office - movement.companyPay);
}

export function cashPosition(data: AppData, from: string, to: string): CashPosition {
  const start = dateKey(from);
  const end = dateKey(to);
  const openings = [...(data.cashOpenings || [])]
    .filter((item) => dateKey(item.date))
    .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || a.createdAt.localeCompare(b.createdAt));

  const anchor = [...openings].reverse().find((item) => !start || dateKey(item.date) <= start);
  let running = anchor ? roundMoney(anchor.amount || 0) : 0;
  let cursor = anchor ? dateKey(anchor.date) : start;
  const openingIsSet = Boolean(anchor && start && dateKey(anchor.date) === start);

  if (anchor && start && cursor < start) {
    for (const day of eachDate(cursor, addDays(start, -1))) {
      running = applyMovement(running, dayMovement(data, day));
    }
  }

  const opening = running;
  const rangeDays = start && end ? eachDate(start, end) : [];
  let estimatedProfit = 0;
  let insExtra = 0;
  let totalProfit = 0;
  let companyPay = 0;
  let house = 0;
  let office = 0;
  for (const day of rangeDays) {
    const movement = dayMovement(data, day);
    running = applyMovement(running, movement);
    totalProfit = roundMoney(totalProfit + movement.totalProfit);
    companyPay = roundMoney(companyPay + movement.companyPay);
    house = roundMoney(house + movement.house);
    office = roundMoney(office + movement.office);
  }

  const policies = (data.policies || []).filter((policy) => inDateRange(policy.date, start, end));
  estimatedProfit = roundMoney(policies.reduce((sum, policy) => sum + policyProfit(policy), 0));
  insExtra = roundMoney(policies.reduce((sum, policy) => sum + insExtraPoAmount(policy), 0));
  const pucIncome = roundMoney(
    (data.pucEntries || [])
      .filter((entry) => inDateRange(entry.date, start, end))
      .reduce((sum, entry) => sum + (entry.amount || 0), 0),
  );

  return {
    opening,
    openingIsSet,
    estimatedProfit,
    insExtra,
    totalProfit,
    companyPay,
    house,
    office,
    pucIncome,
    closing: running,
  };
}

export function sheetRows(opts: {
  policies: Policy[];
  expenses: Expense[];
  receipts: PortalReceipt[];
  opening: number;
  closing: number;
}): SheetRow[] {
  const policies = [...opts.policies].sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.createdAt.localeCompare(b.createdAt));
  const policyRows: SheetRow[] = policies.map((policy) => ({
    issuedDate: policy.date || "",
    party: policy.clientName || "",
    received: policy.received || 0,
    paidToCompany: policy.payment || 0,
    payout: companyPayoutAmount(policy),
    tds: tdsAmount(policy),
    discount: extraPaidAmount(policy),
    house: 0,
    shop: 0,
    insExtra: insExtraPoAmount(policy),
    totalProfit: totalProfitWithExtra(policy),
    balance: customerCredit(policy),
    balanceReceived: policy.received || 0,
    poReceived: 0,
    openClose: "",
    regNo: policy.regNo || "",
    model: policy.vehicleMode || "",
    variant: policy.variant || "",
    rcOwner: policy.rcNumber || "",
    contact: policy.phone || policy.contact || "",
    portal: policy.portal || "",
    company: policy.company || "",
    expiry: policy.expiryDate || "",
    netPremium: policy.netPremium || 0,
    offerPercent: offerPercent(policy) || "",
    estimatedProfit: policyProfit(policy),
  }));

  const expenseRows: SheetRow[] = [...opts.expenses]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((expense) => {
      const house = expenseCategory(expense) === "house";
      const signed = expense.sign === "+" ? expense.amount || 0 : -(expense.amount || 0);
      return {
        issuedDate: expense.date || "",
        party: expense.description || (house ? "House expense" : "Shop expense"),
        received: 0,
        paidToCompany: 0,
        payout: 0,
        tds: 0,
        discount: 0,
        house: house ? signed : 0,
        shop: house ? 0 : signed,
        insExtra: 0,
        totalProfit: 0,
        balance: 0,
        balanceReceived: 0,
        poReceived: 0,
        openClose: "",
        regNo: "",
        model: "",
        variant: "",
        rcOwner: "",
        contact: "",
        portal: "",
        company: "",
        expiry: "",
        netPremium: 0,
        offerPercent: "",
        estimatedProfit: 0,
      };
    });

  const receiptRows: SheetRow[] = [...opts.receipts]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((receipt) => ({
      issuedDate: receipt.date || "",
      party: `PO received from ${receipt.portal || "portal"}`,
      received: 0,
      paidToCompany: 0,
      payout: 0,
      tds: 0,
      discount: 0,
      house: 0,
      shop: 0,
      insExtra: 0,
      totalProfit: 0,
      balance: 0,
      balanceReceived: 0,
      poReceived: receipt.amount || 0,
      openClose: "",
      regNo: "",
      model: "",
      variant: "",
      rcOwner: "",
      contact: "",
      portal: receipt.portal || "",
      company: "",
      expiry: "",
      netPremium: 0,
      offerPercent: "",
      estimatedProfit: 0,
    }));

  const rows = [...policyRows, ...expenseRows, ...receiptRows];
  if (rows.length) rows[0].openClose = opts.opening;
  return rows;
}

export function sheetCells(row: SheetRow): (string | number)[] {
  return [
    row.issuedDate,
    row.party,
    row.received,
    row.paidToCompany,
    row.payout,
    row.tds,
    row.discount,
    row.house,
    row.shop,
    row.insExtra,
    row.totalProfit,
    row.balance,
    row.balanceReceived,
    row.poReceived,
    row.openClose,
    row.regNo,
    row.model,
    row.variant,
    row.rcOwner,
    row.contact,
    row.portal,
    row.company,
    row.expiry,
    row.netPremium,
    row.offerPercent,
    row.estimatedProfit,
  ];
}

export function isFullMonth(from: string, to: string): boolean {
  const start = dateKey(from);
  const end = dateKey(to);
  if (!start || !end || !start.endsWith("-01")) return false;
  const next = addDays(end, 1);
  return Boolean(next && next.endsWith("-01") && next.slice(0, 7) !== start.slice(0, 7) && start.slice(0, 7) === end.slice(0, 7));
}

export function openingOn(openings: CashOpening[] | undefined, date: string): CashOpening | undefined {
  const day = dateKey(date);
  return (openings || []).find((item) => dateKey(item.date) === day);
}
