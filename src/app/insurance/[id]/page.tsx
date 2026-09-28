"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BalanceDue } from "@/components/BalanceDue";
import { DocumentPack } from "@/components/DocumentPack";
import { PolicyForm } from "@/components/PolicyForm";
import { Button, PageHeader, Panel } from "@/components/ui";
import { isCustomFieldKey } from "@/lib/formFields";
import { useStore } from "@/lib/store";
import { blankPolicy, customerBill, customerCredit, extraPaidAmount, insExtraPoAmount, isCreditPayment, offerAmount, policyProfit, tdsAmount, totalProfitWithExtra, usesPointsProfit } from "@/lib/types";
import { formatDDMMYY, formatINR } from "@/lib/utils";
import { printPage, requireOfficeAdminPin } from "@/lib/persist";
import { appAlert, appConfirm } from "@/lib/appDialog";
import { PolicyReceipt } from "@/components/PrintLayouts";

export default function InsuranceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, ready, updatePolicy, deletePolicy } = useStore();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const policy = data.policies.find((p) => p.id === params.id);

  const detailFields = useMemo(() => {
    return [...(data.formFields || [])]
      .filter(
        (f) =>
          f.enabled &&
          !["received", "payment", "customerSidePayment", "paymentMode", "netPremium", "companyOfferPercent", "tdsPercent", "points"].includes(
            f.key,
          ),
      )
      .sort((a, b) => a.order - b.order);
  }, [data.formFields]);

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;
  if (!policy) return <p className="text-sm text-slate-600">Policy not found.</p>;

  const pct =
    policy.companyOfferPercent ||
    (policy.companyOffer && policy.companyOffer <= 100
      ? policy.companyOffer
      : 0) ||
    0;
  const extraPaid = extraPaidAmount(policy);
  const bill = customerBill(policy);
  const credit = customerCredit(policy);
  const pointsMode = usesPointsProfit(policy);

  function fieldDisplay(key: string): string {
    if (isCustomFieldKey(key)) {
      return policy!.customFields?.[key] || "—";
    }
    if (key === "companyOfferPercent") return `${pct || "—"}%`;
    if (key === "tdsPercent") return `${policy!.tdsPercent ?? 2}%`;
    const raw = (policy as unknown as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === "") return "—";
    return String(raw);
  }

  if (editing) {
    return (
      <div>
        <PageHeader title="Edit insurance" />
        <PolicyForm
          initial={{
            ...blankPolicy(),
            ...policy,
            companyOfferPercent: pct,
            confirmed: policy.confirmed ?? false,
            customFields: { ...(policy.customFields || {}) },
          }}
          policyId={policy.id}
          onSaved={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="print-page">
      <Panel className="mb-4 bg-emerald-50 text-sm text-emerald-900">
        Saved. You can edit anytime from this page or the Insurance list.
      </Panel>

      <PageHeader
        title={`Insurance · ${formatDDMMYY(policy.date) || policy.date}`}
        subtitle={`${policy.clientName || "—"} · ${policy.regNo || "—"} · ${
          "Saved"
        }`}
        action={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void printPage()}>
              Print receipt
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => {
                void (async () => {
                  if (deleting) return;
                  setDeleting(true);
                  try {
                    if (!(await requireOfficeAdminPin("delete an insurance entry"))) return;
                    if (
                      !(await appConfirm("Delete this insurance entry? This cannot be undone.", {
                        title: "Delete insurance",
                        confirmLabel: "Delete",
                        danger: true,
                      }))
                    ) {
                      return;
                    }
                    await deletePolicy(policy.id);
                    router.push("/insurance");
                  } catch (error) {
                    await appAlert(
                      error instanceof Error ? error.message : "Could not delete this insurance entry.",
                      "Delete failed",
                    );
                  } finally {
                    setDeleting(false);
                  }
                })();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      />

      {credit > 0 ? (
        <Panel className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">
            Credit: {formatINR(credit)}
          </p>
          <p className="mt-1 text-sm text-red-800">
            {policy.clientName || "Customer"}
            {policy.phone || policy.contact ? ` · ${policy.phone || policy.contact}` : ""}
            {policy.regNo ? ` · ${policy.regNo}` : ""} — customer side {formatINR(bill)}, received{" "}
            {formatINR(policy.received)}. Unpaid credit is highlighted in red.
          </p>
        </Panel>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <p className="text-xs uppercase text-slate-500">Customer side payment</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(bill)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Received from customer</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(policy.received)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Credit</p>
          <p className={`mt-1 text-xl font-semibold ${credit ? "text-red-700" : ""}`}>
            <BalanceDue amount={credit} empty={formatINR(0)} />
          </p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">We pay company</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(policy.payment)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Net premium</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(policy.netPremium)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Estimated profit (portal)</p>
          <p className="mt-1 text-xl font-semibold text-[#0f3d3e]">
            {formatINR(policyProfit(policy))}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Ins Extra PO</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(insExtraPoAmount(policy))}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Total profit</p>
          <p className="mt-1 text-xl font-semibold text-[#0f3d3e]">
            {formatINR(totalProfitWithExtra(policy))}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">TDS ({policy.tdsPercent ?? 2}%)</p>
          <p className="mt-1 text-xl font-semibold text-red-700">−{formatINR(tdsAmount(policy))}</p>
        </Panel>
      </div>

      <Panel className="mb-6 space-y-1 text-sm">
        {pointsMode ? (
          <>
            <p>
              Company profit (points): <strong>{formatINR(policy.points || 0)}</strong>
            </p>
            <p>
              TDS {policy.tdsPercent ?? 2}% of company profit:{" "}
              <strong>−{formatINR(tdsAmount(policy))}</strong>
            </p>
            <p>
              Discount (not taken from company profit): <strong>{formatINR(extraPaid)}</strong>
            </p>
            <p className="text-slate-600">
              Estimated profit (portal) = company profit − TDS. Discount is not deducted. Ins Extra PO is added only in total profit.
            </p>
          </>
        ) : (
          <>
            <p>
              Company profit {pct}%:{" "}
              <strong>
                {formatINR(offerAmount({ ...policy, companyOfferPercent: pct }))}
              </strong>
            </p>
            <p>
              TDS {policy.tdsPercent ?? 2}% of company profit:{" "}
              <strong>−{formatINR(tdsAmount(policy))}</strong>
            </p>
            <p>
              Discount (not taken from company profit): <strong>{formatINR(extraPaid)}</strong>
            </p>
            <p className="text-slate-600">
              Estimated profit (portal) = company profit − TDS. Discount is not deducted. Ins Extra PO is added only in total profit.
            </p>
          </>
        )}
      </Panel>

      <Panel className="mb-6 text-sm">
        <span className="text-slate-500">Points:</span> <strong>{policy.points || 0}</strong>
      </Panel>

      {(policy.customerPayments || []).length ? (
        <Panel className="mb-6 text-sm">
          <h2 className="mb-2 font-semibold">Received from customer</h2>
          <ul className="space-y-1">
            {policy.customerPayments.map((payment) => (
              <li
                key={payment.id}
                className={isCreditPayment(payment.mode) ? "font-semibold text-red-700" : undefined}
              >
                {payment.mode}: <strong>{formatINR(payment.amount)}</strong>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
        {detailFields
          .filter((f) => !["clientName", "regNo", "date"].includes(f.key))
          .map((f) => (
            <p
              key={f.id}
              className={f.type === "textarea" ? "sm:col-span-2" : undefined}
            >
              <span className="text-slate-500">{f.label}:</span>{" "}
              {fieldDisplay(f.key)}
            </p>
          ))}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-base font-semibold">Documents</h2>
        <DocumentPack
          documents={policy.documents || []}
          clientName={policy.clientName}
          variant={policy.variant}
          vehicleMode={policy.vehicleMode}
          portal={policy.portal}
          onChange={(documents) => updatePolicy(policy.id, { documents })}
        />
      </Panel>
      <PolicyReceipt policy={policy} />
    </div>
  );
}
