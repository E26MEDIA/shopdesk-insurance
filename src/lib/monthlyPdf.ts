import type { Policy, PucEntry } from "./types";
import { printHtmlDocument } from "./printHtml";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function profit(p: Policy) {
  return (p.received || 0) - (p.payment || 0) - (p.discount || 0);
}

function esc(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open a printable monthly report (Save as PDF from the print dialog). */
export function downloadMonthlyPdf(opts: {
  monthLabel: string;
  from: string;
  to: string;
  policies: Policy[];
  pucEntries: PucEntry[];
}) {
  const { monthLabel, from, to, policies, pucEntries } = opts;

  const received = policies.reduce((s, p) => s + (p.received || 0), 0);
  const payout = policies.reduce((s, p) => s + (p.payment || 0), 0);
  const discount = policies.reduce((s, p) => s + (p.discount || 0), 0);
  const insuranceProfit = policies.reduce((s, p) => s + profit(p), 0);
  const pucIncome = pucEntries.reduce((s, p) => s + (p.amount || 0), 0);

  const insuranceRows = policies
    .map(
      (p) =>
        `<tr>
          <td>${esc(p.date)}</td>
          <td>${esc(p.clientName)}</td>
          <td>${esc(p.regNo)}</td>
          <td>${esc(p.company)}</td>
          <td>${inr(p.received)}</td>
          <td>${inr(p.payment)}</td>
          <td>${inr(profit(p))}</td>
        </tr>`,
    )
    .join("");

  const pucRows = pucEntries
    .map(
      (p) =>
        `<tr>
          <td>${esc(p.date)}</td>
          <td>${esc(p.clientName || "—")}</td>
          <td>${esc(p.regNo || "—")}</td>
          <td>${esc(p.vehicleMode || "—")}</td>
          <td>${inr(p.amount)}</td>
          <td>${esc(p.notes || "")}</td>
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
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
    @media print {
      body { padding: 0; }
      .noprint { display: none; }
    }
  </style>
</head>
<body>
  <h1>ShopDesk — Monthly Report</h1>
  <p class="meta">${esc(monthLabel)} · ${esc(from)} to ${esc(to)}</p>
  <div class="cards">
    <div class="card">Insurance entries<b>${policies.length}</b></div>
    <div class="card">Received<b>${inr(received)}</b></div>
    <div class="card">Payout<b>${inr(payout)}</b></div>
    <div class="card">Discount<b>${inr(discount)}</b></div>
    <div class="card">Insurance profit<b>${inr(insuranceProfit)}</b></div>
    <div class="card">PUC income (${pucEntries.length})<b>${inr(pucIncome)}</b></div>
    <div class="card">Total profit<b>${inr(insuranceProfit + pucIncome)}</b></div>
  </div>
  <h2>Insurance</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Client</th><th>Vehicle</th><th>Company</th><th>Received</th><th>Payout</th><th>Profit</th></tr>
    </thead>
    <tbody>
      ${insuranceRows || `<tr><td colspan="7">No insurance entries</td></tr>`}
    </tbody>
  </table>
  <h2>PUC</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Client</th><th>Vehicle</th><th>Mode</th><th>Amount</th><th>Notes</th></tr>
    </thead>
    <tbody>
      ${pucRows || `<tr><td colspan="6">No PUC entries</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  printHtmlDocument(html);
}
