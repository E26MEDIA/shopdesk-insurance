import type { Expense, Policy, PucEntry } from "@/lib/types";
import { policyProfit } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export function PolicyReceipt({ policy }: { policy: Policy }) {
  return <section className="print-only print-receipt">
    <header className="print-title"><h1>ShopDesk</h1><p>Insurance receipt</p></header>
    <div className="print-meta"><span>Receipt date: {policy.date}</span><span>{policy.confirmed ? "Confirmed" : "Pending"}</span></div>
    <dl className="print-details">
      <div><dt>Customer</dt><dd>{policy.clientName || "—"}</dd></div>
      <div><dt>Phone</dt><dd>{policy.phone || policy.contact || "—"}</dd></div>
      <div><dt>Vehicle no.</dt><dd>{policy.regNo || "—"}</dd></div>
      <div><dt>Insurance company</dt><dd>{policy.company || "—"}</dd></div>
      <div><dt>Payment mode</dt><dd>{policy.paymentMode || "—"}</dd></div>
      <div><dt>Policy type</dt><dd>{policy.description || "—"}</dd></div>
      <div><dt>Expiry date</dt><dd>{policy.expiryDate || "—"}</dd></div>
    </dl>
    <div className="print-total"><span>Amount received</span><strong>{formatINR(policy.received)}</strong></div>
    <p className="print-note">This is a computer-generated receipt.</p>
  </section>;
}

function ExpensePrintTable({ title, items }: { title: string; items: Expense[] }) {
  if (!items.length) return null;
  return <>
    <h2>{title}</h2>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        {items.map((e) => (
          <tr key={e.id}>
            <td>{e.date}</td>
            <td>{e.description || "—"}</td>
            <td>{e.sign || "-"}{formatINR(e.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </>;
}

export function ReportPrintLayout({
  from,
  to,
  policies,
  pucEntries,
  received,
  payout,
  insuranceProfit,
  pucIncome,
  houseExpenseTotal,
  officeExpenseTotal,
  expenseTotal,
  totalProfit,
  houseExpenses,
  officeExpenses,
}: {
  from: string;
  to: string;
  policies: Policy[];
  pucEntries: PucEntry[];
  received: number;
  payout: number;
  insuranceProfit: number;
  pucIncome: number;
  houseExpenseTotal: number;
  officeExpenseTotal: number;
  expenseTotal: number;
  totalProfit: number;
  houseExpenses: Expense[];
  officeExpenses: Expense[];
}) {
  return <section className="print-only print-report">
    <header className="print-title"><h1>ShopDesk</h1><p>Business report · {from} to {to}</p></header>
    <table><tbody>
      <tr><th>Insurance entries</th><td>{policies.length}</td></tr>
      <tr><th>Received from customers</th><td>{formatINR(received)}</td></tr>
      <tr><th>Paid to companies</th><td>{formatINR(payout)}</td></tr>
      <tr><th>Insurance profit</th><td>{formatINR(insuranceProfit)}</td></tr>
      <tr><th>PUC income</th><td>{formatINR(pucIncome)}</td></tr>
      <tr><th>House expenses (+/−)</th><td>{formatINR(houseExpenseTotal)}</td></tr>
      <tr><th>Office expenses (+/−)</th><td>{formatINR(officeExpenseTotal)}</td></tr>
      <tr><th>Expenses total (+/−)</th><td>{formatINR(expenseTotal)}</td></tr>
      <tr className="print-total-row"><th>Total profit</th><td>{formatINR(totalProfit)}</td></tr>
    </tbody></table>
    <h2>Insurance entries</h2>
    <table>
      <thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Received</th><th>Profit</th></tr></thead>
      <tbody>{policies.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.clientName || "—"}</td><td>{p.regNo || "—"}</td><td>{formatINR(p.received)}</td><td>{formatINR(policyProfit(p))}</td></tr>)}</tbody>
    </table>
    {pucEntries.length ? <><h2>PUC entries</h2><table><thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Amount</th></tr></thead><tbody>{pucEntries.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.clientName || "—"}</td><td>{p.regNo || "—"}</td><td>{formatINR(p.amount)}</td></tr>)}</tbody></table></> : null}
    <ExpensePrintTable title="House expenses" items={houseExpenses} />
    <ExpensePrintTable title="Office expenses" items={officeExpenses} />
  </section>;
}
