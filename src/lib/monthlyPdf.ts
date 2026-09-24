import { cashPosition, isFullMonth, portalPoRows, portalProducts, sheetRows } from "./ledger";
import { saveOrPrintReport } from "./printHtml";
import type { AppData } from "./types";
import { inDateRange } from "./utils";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function esc(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Save monthly report PDF by date into insurance desk reports folder. */
export async function downloadMonthlyPdf(opts: {
  monthLabel: string;
  from: string;
  to: string;
  data: AppData;
  date?: string;
  silent?: boolean;
}) {
  const { monthLabel, from, to, data } = opts;
  const policies = data.policies.filter((policy) => inDateRange(policy.date, from, to));
  const expenses = (data.expenses || []).filter((expense) => inDateRange(expense.date, from, to));
  const receipts = (data.portalReceipts || []).filter((receipt) => inDateRange(receipt.date, from, to));
  const pucEntries = (data.pucEntries || []).filter((entry) => inDateRange(entry.date, from, to));
  const cash = cashPosition(data, from, to);
  const portals = portalPoRows(data, to);
  const products = portalProducts(data, to);
  const rows = sheetRows({
    policies,
    expenses,
    receipts,
    opening: cash.opening,
    closing: cash.closing,
  });
  const closingLabel = isFullMonth(from, to)
    ? `Closing balance for ${monthLabel}`
    : "Closing balance";

  const insuranceRows = rows
    .map(
      (row) => `<tr>
          <td>${esc(row.issuedDate)}</td>
          <td>${esc(row.party)}</td>
          <td>${inr(row.received)}</td>
          <td>${inr(row.paidToCompany)}</td>
          <td>${inr(row.payout)}</td>
          <td>${inr(row.tds)}</td>
          <td>${inr(row.discount)}</td>
          <td>${inr(row.house)}</td>
          <td>${inr(row.shop)}</td>
          <td>${inr(row.insExtra)}</td>
          <td>${inr(row.totalProfit)}</td>
          <td>${inr(row.balance)}</td>
          <td>${inr(row.poReceived)}</td>
          <td>${esc(row.regNo)}</td>
          <td>${esc(row.model)}</td>
          <td>${esc(row.variant)}</td>
          <td>${esc(row.portal)}</td>
          <td>${esc(row.company)}</td>
          <td>${row.offerPercent === "" ? "" : esc(String(row.offerPercent))}</td>
          <td>${inr(row.estimatedProfit)}</td>
        </tr>`,
    )
    .join("");

  const portalRows = portals
    .map(
      (row) => `<tr>
          <td>${esc(row.name)}</td>
          <td>${row.policies}</td>
          <td>${inr(row.toCome)}</td>
          <td>${inr(row.received)}</td>
          <td>${inr(row.pending)}</td>
        </tr>`,
    )
    .join("");

  const productRows = products
    .map(
      (product) => `<tr>
          <td>${esc(product.portal)}</td>
          <td>${esc(product.date)}</td>
          <td>${esc(product.party)}</td>
          <td>${esc(product.regNo)}</td>
          <td>${esc(product.company)}</td>
          <td>${inr(product.netPremium)}</td>
          <td>${product.offerPercent ? esc(String(product.offerPercent)) + "%" : "—"}</td>
          <td>${inr(product.payout)}</td>
          <td>${inr(product.tds)}</td>
          <td>${inr(product.estimated)}</td>
          <td>${inr(product.insExtra)}</td>
          <td>${inr(product.totalProfit)}</td>
        </tr>`,
    )
    .join("");

  const pucRows = pucEntries
    .map(
      (entry) => `<tr>
          <td>${esc(entry.date)}</td>
          <td>${esc(entry.clientName || "—")}</td>
          <td>${esc(entry.regNo || "—")}</td>
          <td>${inr(entry.amount)}</td>
          <td>${esc(entry.notes || "")}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ShopDesk Monthly Report — ${esc(monthLabel)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    p, td, th { font-size: 12px; }
    .meta { color: #475569; margin-bottom: 16px; }
    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0 20px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
    .card b { display: block; font-size: 14px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; white-space: nowrap; }
    table.wide { font-size: 10px; }
    th { background: #f1f5f9; }
    @media print {
      body { padding: 0; }
      .noprint { display: none; }
    }
  </style>
</head>
<body>
  <h1>ShopDesk — Report</h1>
  <p class="meta">${esc(monthLabel)} · ${esc(from)} to ${esc(to)}</p>
  <div class="cards">
    <div class="card">Opening balance<b>${inr(cash.opening)}</b></div>
    <div class="card">Estimated profit (portal)<b>${inr(cash.estimatedProfit)}</b></div>
    <div class="card">Ins Extra PO<b>${inr(cash.insExtra)}</b></div>
    <div class="card">Total profit<b>${inr(cash.totalProfit)}</b></div>
    <div class="card">Company / portal payment<b>${inr(cash.companyPay)}</b></div>
    <div class="card">House expense<b>${inr(cash.house)}</b></div>
    <div class="card">Shop / office expense<b>${inr(cash.office)}</b></div>
    <div class="card">${esc(closingLabel)}<b>${inr(cash.closing)}</b></div>
  </div>
  <p class="meta">Closing = opening + total profit (including Ins Extra PO) − company/portal payment − house expense − shop expense. PUC certificate income ${inr(cash.pucIncome)} is listed separately and is not in this closing.</p>
  <h2>Entries</h2>
  <table class="wide">
    <thead>
      <tr>
        <th>ISSUED Date</th><th>PARTY</th><th>Received from party</th><th>Paid to company</th><th>PAYOUT</th><th>TDS</th><th>DISCOUNT</th><th>HSE EXP</th><th>SH EXP</th><th>Ins Extra PO</th><th>TOTAL PROFIT</th><th>BALANCE AMT</th><th>PO RCVD FROM CO</th><th>REG NO</th><th>MODEL</th><th>VARIENT</th><th>PORTAL</th><th>Company</th><th>Offer %</th><th>Estimated profit</th>
      </tr>
    </thead>
    <tbody>
      ${insuranceRows || `<tr><td colspan="20">No entries</td></tr>`}
    </tbody>
  </table>
  <h2>Portal PO</h2>
  <p class="meta">Total earning is from insurance on that portal. Received is typed in. Pending = total earning − received. Ins Extra PO is not in the earning.</p>
  <table>
    <thead>
      <tr><th>Portal</th><th>Insurance</th><th>Total earning</th><th>Received</th><th>Pending</th></tr>
    </thead>
    <tbody>
      ${portalRows || `<tr><td colspan="5">No portal payout yet</td></tr>`}
    </tbody>
  </table>
  <h2>Product amount detail</h2>
  <table class="wide">
    <thead>
      <tr><th>Portal</th><th>Date</th><th>Party</th><th>REG NO</th><th>Company</th><th>Net premium</th><th>Offer %</th><th>Payout</th><th>TDS</th><th>Estimated earning</th><th>Ins Extra PO</th><th>Total profit</th></tr>
    </thead>
    <tbody>
      ${productRows || `<tr><td colspan="12">No insurance products</td></tr>`}
    </tbody>
  </table>
  <h2>PUC certificates</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Client</th><th>Vehicle</th><th>Amount</th><th>Notes</th></tr>
    </thead>
    <tbody>
      ${pucRows || `<tr><td colspan="5">No PUC certificate entries</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  return saveOrPrintReport({
    html,
    kind: "monthly-report",
    date: opts.date || opts.to || opts.from || new Date().toISOString().slice(0, 10),
    silent: opts.silent,
  });
}
