"use client";

import { useMemo, useState } from "react";
import { DecimalInput } from "@/components/DecimalInput";
import { Button, Panel } from "@/components/ui";
import { portalPoRows, portalProducts, type PortalPoRow, type PortalProduct } from "@/lib/ledger";
import { requireOfficeAdminPin } from "@/lib/persist";
import { useStore } from "@/lib/store";
import { formatINR, todayISO } from "@/lib/utils";

export function PortalPoBoard({ asOf, compact = false }: { asOf: string; compact?: boolean }) {
  const { data, addPortalReceipt, deletePortalReceipt } = useStore();
  const today = todayISO();
  const rows = useMemo(() => portalPoRows(data, asOf), [data, asOf]);
  const products = useMemo(() => portalProducts(data, asOf), [data, asOf]);
  const visible = rows;

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="text-base font-semibold text-slate-900">Portal PO</h2>
        <p className="mt-1 text-sm text-slate-600">
          Total earning is the company offer % on insurance saved for that portal. Direct points and Ins Extra PO are not included.
          Type the money received yourself. Pending is total earning minus received. A portal appears here once it has that earning or a receipt.
        </p>
      </Panel>
      {visible.length === 0 ? (
        <Panel>
          <p className="text-sm text-slate-600">
            No company-offer earning yet. Save an insurance with a company offer % and the portal appears here.
          </p>
        </Panel>
      ) : (
        visible.map((row) => (
          <PortalCard
            key={row.name}
            row={row}
            products={products.filter((product) => product.portal.toLowerCase() === row.name.toLowerCase())}
            today={today}
            receipts={(data.portalReceipts || []).filter(
              (receipt) => receipt.portal.trim().toLowerCase() === row.name.toLowerCase() && (!asOf || receipt.date <= asOf),
            )}
            onAdd={(amount) =>
              addPortalReceipt({
                date: today,
                portal: row.name,
                amount,
                notes: "Received from portal",
              })
            }
            onDelete={(id) => deletePortalReceipt(id)}
            showProducts={!compact || row.policies > 0}
          />
        ))
      )}
    </div>
  );
}

function PortalCard({
  row,
  products,
  today,
  receipts,
  onAdd,
  onDelete,
  showProducts,
}: {
  row: PortalPoRow;
  products: PortalProduct[];
  today: string;
  receipts: { id: string; date: string; amount: number; notes: string }[];
  onAdd: (amount: number) => void;
  onDelete: (id: string) => void;
  showProducts: boolean;
}) {
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState("");

  function addReceived() {
    if (!amount) {
      setStatus("Enter the amount received.");
      return;
    }
    onAdd(amount);
    setAmount(0);
    setStatus(`Received amount added for ${row.name}. Pending updated.`);
  }

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{row.name}</h3>
        <p className="text-xs text-slate-500">
          {row.policies} insurance {row.policies === 1 ? "entry" : "entries"}
          {row.companies.length ? ` · ${row.companies.join(", ")}` : ""}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total earning</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatINR(row.toCome)}</p>
          <p className="mt-1 text-xs text-slate-500">Automatic from insurance on this portal. Not Ins Extra PO.</p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Money received</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatINR(row.received)}</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1">
              <DecimalInput
                value={amount}
                onValue={setAmount}
                maxDecimals={2}
                placeholder="Type amount"
                aria-label={`Money received for ${row.name}`}
              />
            </div>
            <Button type="button" onClick={addReceived}>
              Add received
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Type what came in from {row.name} on {today}. This adds to the received total.</p>
        </div>
        <div className={`rounded-md border px-3 py-3 ${row.pending > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
          <p className={`mt-1 text-xl font-semibold ${row.pending > 0 ? "text-amber-800" : "text-emerald-800"}`}>
            {formatINR(row.pending)}
          </p>
          <p className="mt-1 text-xs text-slate-600">Total earning − money received.</p>
        </div>
      </div>
      {status ? <p className="mt-2 text-sm text-[#0f3d3e]">{status}</p> : null}

      {showProducts ? (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-sm font-medium text-slate-800">Product amount detail</p>
          {products.length === 0 ? (
            <p className="text-sm text-slate-600">No insurance on {row.name} yet. Saving a customer on this portal fills the earning.</p>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Party</th>
                  <th className="px-2 py-2 font-medium">REG NO</th>
                  <th className="px-2 py-2 font-medium">Company</th>
                  <th className="px-2 py-2 font-medium">Net premium</th>
                  <th className="px-2 py-2 font-medium">Offer %</th>
                  <th className="px-2 py-2 font-medium">Payout</th>
                  <th className="px-2 py-2 font-medium">TDS</th>
                  <th className="px-2 py-2 font-medium">Estimated earning</th>
                  <th className="px-2 py-2 font-medium">Ins Extra PO</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{product.date}</td>
                    <td className="px-2 py-2">{product.party || "—"}</td>
                    <td className="px-2 py-2">{product.regNo || "—"}</td>
                    <td className="px-2 py-2">{product.company || "—"}</td>
                    <td className="px-2 py-2">{formatINR(product.netPremium)}</td>
                    <td className="px-2 py-2">{product.offerPercent ? `${product.offerPercent}%` : "—"}</td>
                    <td className="px-2 py-2">{formatINR(product.payout)}</td>
                    <td className="px-2 py-2">{formatINR(product.tds)}</td>
                    <td className="px-2 py-2 font-medium">{formatINR(product.estimated)}</td>
                    <td className="px-2 py-2">{formatINR(product.insExtra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {receipts.length ? (
        <ul className="mt-3 space-y-1">
          {receipts.map((receipt) => (
            <li key={receipt.id} className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                Received {formatINR(receipt.amount)} on {receipt.date}
                {receipt.notes ? ` · ${receipt.notes}` : ""}
              </span>
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() => {
                  void (async () => {
                    if (await requireOfficeAdminPin("delete a portal receipt")) onDelete(receipt.id);
                  })();
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
