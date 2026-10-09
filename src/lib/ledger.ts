import {
  companyPayoutAmount,
  customerCredit,
  expenseCategory,
  expenseNet,
  extraPaidAmount,
  insExtraPoAmount,
  isCreditPayment,
  offerPercent,
  policyProfit,
  roundMoney,
  tdsAmount,
  totalProfitWithExtra,
  usesPointsProfit,
  type AppData,
  type CashOpening,
  type Expense,
  type Policy,
  type PortalReceipt,
  type Advance,
  type PucEntry,
} from "./types";
import { advanceTypeLabel } from "./utils";
import { dateKey, inDateRange } from "./utils";

export type CompanyTds = {
  company: string;
  tds: number;
  policies: number;
};

export type PortalPoRow = {
  name: string;
  kind: "Portal" | "Company";
  companies: string[];
  policies: number;
  /** Estimated portal profit: company payout − TDS − discount. Ins Extra PO is not included. */
  toCome: number;
  discount: number;
  received: number;
  pending: number;
  tds: number;
  companyTds: CompanyTds[];
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
  receivedProfit: number;
  pendingProfit: number;
  /** Estimated portal profit + Ins Extra PO. PUC is not included. */
  insuranceProfit: number;
  /** Insurance profit + PUC profit. */
  totalProfit: number;
  tds: number;
  companyPay: number;
  customerReceived: number;
  house: number;
  office: number;
  pucIncome: number;
  /** Signed PUC expenses. A minus expense is negative and reduces the closing balance. */
  pucExpense: number;
  /** Advance amounts received in the range. Added into that day's opening. */
  advances: number;
  poReceived: number;
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

/** Column order from the shop’s FINAL REPORT workbook. */
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

function addCompanyTds(row: PortalPoRow, company: string, tds: number) {
  const amount = roundMoney(tds || 0);
  if (!amount) return;
  const name = company.trim() || "Unassigned";
  const existing = row.companyTds.find((item) => sameName(item.company, name));
  if (existing) {
    existing.tds = roundMoney(existing.tds + amount);
    existing.policies += 1;
  } else {
    row.companyTds.push({ company: name, tds: amount, policies: 1 });
  }
  row.tds = roundMoney(row.tds + amount);
}

export function tdsByCompany(policies: Policy[]): CompanyTds[] {
  const map = new Map<string, CompanyTds>();
  for (const policy of policies) {
    const amount = roundMoney(tdsAmount(policy));
    if (!amount) continue;
    const name = String(policy.company || "").trim() || "Unassigned";
    const key = name.toLowerCase();
    const row = map.get(key) || { company: name, tds: 0, policies: 0 };
    row.tds = roundMoney(row.tds + amount);
    row.policies += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.tds - a.tds || a.company.localeCompare(b.company));
}

/** TDS grouped by the portal on the insurance, not the insurance company. */
export function tdsByPortal(policies: Policy[]): CompanyTds[] {
  const map = new Map<string, CompanyTds>();
  for (const policy of policies) {
    const amount = roundMoney(tdsAmount(policy));
    if (!amount) continue;
    const name = String(policy.portal || "").trim() || "Unassigned";
    const key = name.toLowerCase();
    const row = map.get(key) || { company: name, tds: 0, policies: 0 };
    row.tds = roundMoney(row.tds + amount);
    row.policies += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.tds - a.tds || a.company.localeCompare(b.company));
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
    discount: 0,
    received: 0,
    pending: 0,
    tds: 0,
    companyTds: [],
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

/** Insurance that earns portal money, dated on or before `to`, newest first. */
export function portalProducts(
  data: Pick<AppData, "policies">,
  to?: string,
  from?: string,
): PortalProduct[] {
  const end = dateKey(to);
  const start = dateKey(from);
  return (data.policies || [])
    .filter((policy) => earnsPortalProfit(policy))
    .filter((policy) => !start || !dateKey(policy.date) || dateKey(policy.date) >= start)
    .filter((policy) => !end || !dateKey(policy.date) || dateKey(policy.date) <= end)
    .map(portalProductFromPolicy)
    .sort((a, b) => a.portal.localeCompare(b.portal) || b.date.localeCompare(a.date) || a.party.localeCompare(b.party));
}

/** True when this insurance earns portal money from a company offer %. */
export function hasCompanyOfferPercent(policy: Pick<Policy, "netPremium" | "companyOfferPercent" | "companyOffer">): boolean {
  return offerPercent(policy) > 0;
}

/** Company-offer profit and direct points both belong to the portal named on the insurance. */
export function earnsPortalProfit(policy: Policy): boolean {
  return hasCompanyOfferPercent(policy) || usesPointsProfit(policy);
}

/**
 * One row for every portal in Admin, plus any portal named on an insurance.
 * A new portal shows here before its first customer.
 * Earning is that portal’s company profit after TDS and discount.
 * Ins Extra PO is not added.
 * Direct points on a portal are included.
 */
export function portalPoRows(data: Pick<AppData, "policies" | "portalReceipts" | "masters">, to: string, from?: string): PortalPoRow[] {
  const end = dateKey(to);
  const start = dateKey(from);
  const map = new Map<string, Bucket>();

  for (const portal of data.masters?.portals || []) {
    if (portal.label.trim()) bucketFor(map, portal.label, "Portal");
  }

  for (const policy of data.policies || []) {
    if (end && dateKey(policy.date) > end) continue;
    if (start && dateKey(policy.date) < start) continue;
    if (!earnsPortalProfit(policy)) continue;
    const group = portalGroupName(policy);
    const row = bucketFor(map, group.name, group.kind);
    row.policies += 1;
    // Portal earning is the net amount expected from the portal after TDS and
    // discount. The discount must not be added back into this total.
    row.toCome = roundMoney(row.toCome + policyProfit(policy));
    row.discount = roundMoney(row.discount + extraPaidAmount(policy));
    addCompanyTds(row, String(policy.company || "").trim(), tdsAmount(policy));
    const company = String(policy.company || "").trim();
    if (company && !row.companies.some((item) => sameName(item, company)) && !sameName(company, row.name)) {
      row.companies.push(company);
    }
  }

  for (const receipt of data.portalReceipts || []) {
    if (end && dateKey(receipt.date) > end) continue;
    if (start && dateKey(receipt.date) < start) continue;
    const name = String(receipt.portal || "").trim();
    if (!name) continue;
    const row = bucketFor(map, name, "Portal");
    row.received = roundMoney(row.received + (receipt.amount || 0));
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      companies: [...row.companies].sort((a, b) => a.localeCompare(b)),
      companyTds: [...row.companyTds].sort((a, b) => b.tds - a.tds || a.company.localeCompare(b.company)),
      pending: roundMoney(Math.max(0, row.toCome - row.received)),
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
  const pucExpenses = expenses.filter((expense) => expenseCategory(expense) === "puc");
  const poReceived = (data.portalReceipts || [])
    .filter((receipt) => dateKey(receipt.date) === day)
    .reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  const pendingProfit = roundMoney(policies
    .filter((policy) => earnsPortalProfit(policy))
    .reduce((sum, policy) => sum + policyProfit(policy), 0));
  const receivedProfit = roundMoney(policies.reduce((sum, policy) => sum + insExtraPoAmount(policy), 0));
  const insuranceProfit = roundMoney(pendingProfit + receivedProfit);
  const customerReceived = roundMoney(policies.reduce((sum, policy) => {
    const cashParts = (policy.customerPayments || []).filter((part) => !isCreditPayment(part.mode));
    if (!cashParts.length) return sum + (policy.date === day ? policy.received || 0 : 0);
    return sum + cashParts
      .filter((part) => (part.receivedOn || policy.date) === day)
      .reduce((partSum, part) => partSum + (part.amount || 0), 0);
  }, 0));
  const puc = roundMoney(
    (data.pucEntries || [])
      .filter((entry) => dateKey(entry.date) === day)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0),
  );
  return {
    insuranceProfit,
    receivedProfit,
    pendingProfit,
    puc,
    totalProfit: roundMoney(insuranceProfit + puc),
    customerReceived,
    companyPay: roundMoney(policies.reduce((sum, policy) => sum + (policy.payment || 0), 0)),
    house: expenseNet(house),
    office: expenseNet(office),
    pucExpense: expenseNet(pucExpenses),
    poReceived: roundMoney(poReceived),
  };
}

function applyMovement(opening: number, movement: ReturnType<typeof dayMovement>): number {
  return roundMoney(
    opening + movement.customerReceived + movement.puc + movement.house + movement.office + movement.pucExpense + movement.poReceived - movement.companyPay,
  );
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

  function extrasOn(day: string): number {
    const invested = (data.openingEntries || [])
      .filter((entry) => dateKey(entry.date) === day)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const advances = (data.advances || [])
      .filter((entry) => dateKey(entry.date) === day)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
    return roundMoney(invested + advances);
  }

  if (anchor && start && cursor < start) {
    for (const day of eachDate(cursor, addDays(start, -1))) {
      running = applyMovement(running + extrasOn(day), dayMovement(data, day));
    }
  }

  const opening = roundMoney(running + (start ? extrasOn(start) : 0));
  running = opening;
  const rangeDays = start && end ? eachDate(start, end) : [];
  let insuranceProfit = 0;
  let receivedProfit = 0;
  let pendingProfit = 0;
  let pucIncome = 0;
  let companyPay = 0;
  let customerReceived = 0;
  let house = 0;
  let office = 0;
  let pucExpense = 0;
  let advances = 0;
  let poReceived = 0;
  for (const day of rangeDays) {
    if (day !== start) running = roundMoney(running + extrasOn(day));
    const movement = dayMovement(data, day);
    running = applyMovement(running, movement);
    insuranceProfit = roundMoney(insuranceProfit + movement.insuranceProfit);
    receivedProfit = roundMoney(receivedProfit + movement.receivedProfit);
    pendingProfit = roundMoney(pendingProfit + movement.pendingProfit);
    pucIncome = roundMoney(pucIncome + movement.puc);
    companyPay = roundMoney(companyPay + movement.companyPay);
    customerReceived = roundMoney(customerReceived + movement.customerReceived);
    house = roundMoney(house + movement.house);
    office = roundMoney(office + movement.office);
    pucExpense = roundMoney(pucExpense + movement.pucExpense);
    advances = roundMoney(
      advances +
        (data.advances || [])
          .filter((entry) => dateKey(entry.date) === day)
          .reduce((sum, entry) => sum + (entry.amount || 0), 0),
    );
    advances = roundMoney(
      advances +
        (data.openingEntries || [])
          .filter((entry) => dateKey(entry.date) === day && entry.kind.trim().toLowerCase() === "customer advance")
          .reduce((sum, entry) => sum + (entry.amount || 0), 0),
    );
    poReceived = roundMoney(poReceived + movement.poReceived);
  }

  const policies = (data.policies || []).filter((policy) => inDateRange(policy.date, start, end));
  const estimatedProfit = roundMoney(policies
    .filter((policy) => earnsPortalProfit(policy))
    .reduce((sum, policy) => sum + policyProfit(policy), 0));
  const insExtra = roundMoney(policies.reduce((sum, policy) => sum + insExtraPoAmount(policy), 0));
  const tds = roundMoney(policies.reduce((sum, policy) => sum + tdsAmount(policy), 0));
  // Portal receipts settle the pending company profit. They are actual cash
  // already included in closing, so keep only the unpaid remainder here.
  pendingProfit = roundMoney(Math.max(0, pendingProfit - poReceived));
  const totalProfit = roundMoney(receivedProfit + pendingProfit + pucIncome);

  return {
    opening,
    openingIsSet,
    estimatedProfit,
    insExtra,
    receivedProfit,
    pendingProfit,
    insuranceProfit,
    totalProfit,
    tds,
    companyPay,
    customerReceived,
    house,
    office,
    pucIncome,
    pucExpense,
    advances,
    poReceived,
    closing: running,
  };
}

export function sheetRows(opts: {
  policies: Policy[];
  expenses: Expense[];
  receipts: PortalReceipt[];
  pucEntries?: PucEntry[];
  advances?: Advance[];
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
      const category = expenseCategory(expense);
      const house = category === "house";
      const signed = expense.sign === "+" ? expense.amount || 0 : -(expense.amount || 0);
      return {
        issuedDate: expense.date || "",
        party: expense.description || (house ? "House expense" : category === "puc" ? "PUC expense" : "Shop expense"),
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

  const pucRows: SheetRow[] = [...(opts.pucEntries || [])]
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.createdAt.localeCompare(b.createdAt))
    .map((entry) => ({
      issuedDate: entry.date || "",
      party: entry.clientName ? `PUC · ${entry.clientName}` : "PUC certificate",
      received: 0,
      paidToCompany: 0,
      payout: 0,
      tds: 0,
      discount: 0,
      house: 0,
      shop: 0,
      insExtra: 0,
      totalProfit: entry.amount || 0,
      balance: 0,
      balanceReceived: 0,
      poReceived: 0,
      openClose: "",
      regNo: entry.regNo || "",
      model: entry.vehicleMode || "",
      variant: "",
      rcOwner: "",
      contact: "",
      portal: "",
      company: "PUC",
      expiry: "",
      netPremium: 0,
      offerPercent: "",
      estimatedProfit: 0,
    }));

  const advanceRows: SheetRow[] = [...(opts.advances || [])]
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.createdAt.localeCompare(b.createdAt))
    .map((entry) => ({
      issuedDate: entry.date || "",
      party: `Advance received · ${advanceTypeLabel(entry.kind)}${entry.description ? ` · ${entry.description}` : ""}`,
      received: entry.amount || 0,
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
      poReceived: 0,
      openClose: "",
      regNo: entry.regNo || "",
      model: "",
      variant: "",
      rcOwner: "",
      contact: entry.phone || "",
      portal: "",
      company: "",
      expiry: "",
      netPremium: 0,
      offerPercent: "",
      estimatedProfit: 0,
    }));

  const rows = [...policyRows, ...pucRows, ...advanceRows, ...expenseRows, ...receiptRows];
  if (rows.length) rows[0].openClose = opts.opening;
  return rows;
}

export function sheetTotals(rows: SheetRow[]) {
  return rows.reduce(
    (sum, row) => ({
      received: roundMoney(sum.received + row.received),
      paid: roundMoney(sum.paid + row.paidToCompany),
      payout: roundMoney(sum.payout + row.payout),
      tds: roundMoney(sum.tds + row.tds),
      discount: roundMoney(sum.discount + row.discount),
      house: roundMoney(sum.house + row.house),
      shop: roundMoney(sum.shop + row.shop),
      insExtra: roundMoney(sum.insExtra + row.insExtra),
      totalProfit: roundMoney(sum.totalProfit + row.totalProfit),
      balance: roundMoney(sum.balance + row.balance),
      balanceReceived: roundMoney(sum.balanceReceived + row.balanceReceived),
      poReceived: roundMoney(sum.poReceived + row.poReceived),
      estimated: roundMoney(sum.estimated + row.estimatedProfit),
    }),
    {
      received: 0,
      paid: 0,
      payout: 0,
      tds: 0,
      discount: 0,
      house: 0,
      shop: 0,
      insExtra: 0,
      totalProfit: 0,
      balance: 0,
      balanceReceived: 0,
      poReceived: 0,
      estimated: 0,
    },
  );
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
