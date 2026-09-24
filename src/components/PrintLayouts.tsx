import type { Policy, PucEntry } from "@/lib/types";
import { customerBill, customerCredit } from "@/lib/types";
import type { CashPosition, PortalPoRow, SheetRow } from "@/lib/ledger";
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
    <div className="print-total"><span>Customer side payment</span><strong>{formatINR(customerBill(policy))}</strong></div>
    <div className="print-total"><span>Amount received</span><strong>{formatINR(policy.received)}</strong></div>
    {customerCredit(policy) > 0 ? (
      <div className="print-total" style={{ color: "#b91c1c" }}>
        <span>Credit</span>
        <strong>{formatINR(customerCredit(policy))}</strong>
      </div>
    ) : null}
    <p className="print-note">This is a computer-generated receipt.</p>
  </section>;
}

export function ReportPrintLayout({
  from,
  to,
  cash,
  rows,
  portals,
  pucEntries,
  closingLabel,
}: {
  from: string;
  to: string;
  cash: CashPosition;
  rows: SheetRow[];
  portals: PortalPoRow[];
  pucEntries: PucEntry[];
  closingLabel: string;
}) {
  const activePortals = portals.filter((row) => row.toCome || row.received || row.pending);
  return <section className="print-only print-report">
    <header className="print-title"><h1>ShopDesk</h1><p>Business report · {from} to {to}</p></header>
    <table><tbody>
      <tr><th>Opening balance</th><td>{formatINR(cash.opening)}</td></tr>
      <tr><th>Estimated profit (portal)</th><td>{formatINR(cash.estimatedProfit)}</td></tr>
      <tr><th>Ins Extra PO</th><td>{formatINR(cash.insExtra)}</td></tr>
      <tr><th>Total profit</th><td>{formatINR(cash.totalProfit)}</td></tr>
      <tr><th>Company / portal payment</th><td>{formatINR(cash.companyPay)}</td></tr>
      <tr><th>House expense</th><td>{formatINR(cash.house)}</td></tr>
      <tr><th>Shop / office expense</th><td>{formatINR(cash.office)}</td></tr>
      <tr className="print-total-row"><th>{closingLabel}</th><td>{formatINR(cash.closing)}</td></tr>
    </tbody></table>
    <h2>Entries</h2>
    <table>
      <thead><tr><th>Date</th><th>Party</th><th>Received</th><th>Paid to company</th><th>Payout</th><th>Ins Extra PO</th><th>Total profit</th><th>Estimated</th><th>Portal</th><th>Company</th></tr></thead>
      <tbody>{rows.map((row, index) => (
        <tr key={`${row.issuedDate}-${row.party}-${index}`}>
          <td>{row.issuedDate}</td>
          <td>{row.party || "—"}</td>
          <td>{formatINR(row.received)}</td>
          <td>{formatINR(row.paidToCompany)}</td>
          <td>{formatINR(row.payout)}</td>
          <td>{formatINR(row.insExtra)}</td>
          <td>{formatINR(row.totalProfit)}</td>
          <td>{formatINR(row.estimatedProfit)}</td>
          <td>{row.portal || "—"}</td>
          <td>{row.company || "—"}</td>
        </tr>
      ))}</tbody>
    </table>
    <h2>Portal PO</h2>
    <table>
      <thead><tr><th>Portal</th><th>Total earning</th><th>Received</th><th>Pending</th></tr></thead>
      <tbody>{activePortals.map((row) => (
        <tr key={row.name}><td>{row.name}</td><td>{formatINR(row.toCome)}</td><td>{formatINR(row.received)}</td><td>{formatINR(row.pending)}</td></tr>
      ))}</tbody>
    </table>
    {pucEntries.length ? <><h2>PUC certificates</h2><table><thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Amount</th></tr></thead><tbody>{pucEntries.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.clientName || "—"}</td><td>{p.regNo || "—"}</td><td>{formatINR(p.amount)}</td></tr>)}</tbody></table></> : null}
  </section>;
}
