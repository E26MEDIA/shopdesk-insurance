import { customerBalanceDue, expenseCategory, expenseNet, policyProfit, tdsAmount, type Expense, type Policy, type PucEntry } from "./types";
import { saveOrPrintReport } from "./printHtml";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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
  policies: Policy[];
  pucEntries: PucEntry[];
  expenses?: Expense[];
  date?: string;
  silent?: boolean;
}) {
  const { monthLabel, from, to, policies, pucEntries } = opts;
  const expenses = opts.expenses || [];

  const received = policies.reduce((s, p) => s + (p.received || 0), 0);
  const payout = policies.reduce((s, p) => s + (p.payment || 0), 0);
  const balanceDue = policies.reduce((s, p) => s + customerBalanceDue(p), 0);
  const tds = policies.reduce((s, p) => s + tdsAmount(p), 0);
  const insuranceProfit = policies.reduce((s, p) => s + policyProfit(p), 0);
  const pucIncome = pucEntries.reduce((s, p) => s + (p.amount || 0), 0);
  const house = expenses.filter((e) => expenseCategory(e) === "house");
  const office = expenses.filter((e) => expenseCategory(e) === "office");
  const houseNet = expenseNet(house);
  const officeNet = expenseNet(office);
  const totalProfit = insuranceProfit + pucIncome + houseNet + officeNet;

  const insuranceRows = policies
    .map((p) => {
      const due = customerBalanceDue(p);
      return `<tr${due ? ' style="color:#b91c1c"' : ""}>
          <td>${esc(p.date)}</td>
          <td>${esc(p.clientName)}</td>
          <td>${esc(p.phone || p.contact || "—")}</td>
          <td>${esc(p.regNo)}</td>
          <td>${esc(p.company)}</td>
          <td>${inr(p.received)}</td>
          <td>${inr(p.payment)}</td>
          <td>${due ? inr(due) : "—"}</td>
          <td>${inr(policyProfit(p))}</td>
        </tr>`;
    })
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

  const expenseRows = (list: Expense[]) =>
    list
      .map(
        (e) =>
          `<tr>
            <td>${esc(e.date)}</td>
            <td>${esc(e.description || "—")}</td>
            <td>${esc(e.sign || "-")}${inr(e.amount)}</td>
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
    <div class="card" style="border-color:#fecaca;color:#b91c1c">Customer balance due<b>${inr(balanceDue)}</b></div>
    <div class="card">TDS deducted<b>−${inr(tds)}</b></div>
    <div class="card">Insurance profit<b>${inr(insuranceProfit)}</b></div>
    <div class="card">PUC income (${pucEntries.length})<b>${inr(pucIncome)}</b></div>
    <div class="card">House expenses<b>${inr(houseNet)}</b></div>
    <div class="card">Office expenses<b>${inr(officeNet)}</b></div>
    <div class="card">Total profit<b>${inr(totalProfit)}</b></div>
  </div>
  <h2>Insurance</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Client</th><th>Phone</th><th>Vehicle</th><th>Company</th><th>Received</th><th>Payout</th><th>Balance due</th><th>Profit</th></tr>
    </thead>
    <tbody>
      ${insuranceRows || `<tr><td colspan="9">No insurance entries</td></tr>`}
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
  <h2>House expenses</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Description</th><th>Amount</th></tr>
    </thead>
    <tbody>
      ${expenseRows(house) || `<tr><td colspan="3">No house expenses</td></tr>`}
    </tbody>
  </table>
  <h2>Office expenses</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Description</th><th>Amount</th></tr>
    </thead>
    <tbody>
      ${expenseRows(office) || `<tr><td colspan="3">No office expenses</td></tr>`}
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
