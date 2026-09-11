"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DocumentPack } from "@/components/DocumentPack";
import { PolicyForm } from "@/components/PolicyForm";
import { Button, PageHeader, Panel } from "@/components/ui";
import { isCustomFieldKey } from "@/lib/formFields";
import { useStore } from "@/lib/store";
import { blankPolicy, extraPaidAmount, offerAmount, policyProfit, tdsAmount, usesPointsProfit } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { printPage } from "@/lib/persist";
import { requireOfficeAdminPin } from "@/lib/persist";
import { PolicyReceipt } from "@/components/PrintLayouts";

export default function InsuranceDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, ready, updatePolicy, confirmPolicy, deletePolicy } = useStore();
  const [editing, setEditing] = useState(false);
  const policy = data.policies.find((p) => p.id === params.id);

  const detailFields = useMemo(() => {
    return [...(data.formFields || [])]
      .filter(
        (f) =>
          f.enabled &&
          !["received", "payment", "netPremium", "companyOfferPercent", "tdsPercent", "points"].includes(
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
      {!policy.confirmed ? (
        <Panel className="mb-4 border-[#0f3d3e] bg-teal-50">
          <p className="mb-3 text-sm font-medium text-[#0f3d3e]">
            Please confirm this insurance entry, or edit if something is wrong.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => confirmPolicy(policy.id)}
            >
              Confirm
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel className="mb-4 bg-emerald-50 text-sm text-emerald-900">
          Confirmed. You can still edit anytime from this page or the Insurance
          list.
        </Panel>
      )}

      <PageHeader
        title={`Insurance · ${policy.date}`}
        subtitle={`${policy.clientName || "—"} · ${policy.regNo || "—"} · ${
          policy.confirmed ? "Confirmed" : "Pending confirm"
        }`}
        action={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void printPage()}>
              Print receipt
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            {!policy.confirmed ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => confirmPolicy(policy.id)}
              >
                Confirm
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={() => {
                void (async () => {
                if (!(await requireOfficeAdminPin("delete an insurance entry"))) return;
                if (confirm("Delete this insurance entry?")) {
                  deletePolicy(policy.id);
                  window.location.href = "/insurance";
                }
                })();
              }}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <p className="text-xs uppercase text-slate-500">From customer</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(policy.received)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Paid to company</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(policy.payment)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Net premium</p>
          <p className="mt-1 text-xl font-semibold">{formatINR(policy.netPremium)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase text-slate-500">Profit</p>
          <p className="mt-1 text-xl font-semibold text-[#0f3d3e]">
            {formatINR(policyProfit(policy))}
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
              Direct profit (points): <strong>{formatINR(policy.points || 0)}</strong>
            </p>
            <p>
              TDS {policy.tdsPercent ?? 2}% of points:{" "}
              <strong>−{formatINR(tdsAmount(policy))}</strong>
            </p>
            <p className="text-slate-600">Actual profit = points − TDS</p>
          </>
        ) : (
          <>
            <p>
              Company offer profit {pct}%:{" "}
              <strong>
                {formatINR(offerAmount({ ...policy, companyOfferPercent: pct }))}
              </strong>
            </p>
            <p>
              Discount: <strong>−{formatINR(extraPaid)}</strong>
            </p>
            <p>
              Net profit:{" "}
              <strong>
                {formatINR(
                  offerAmount({ ...policy, companyOfferPercent: pct }) - extraPaid,
                )}
              </strong>
            </p>
            <p>
              TDS {policy.tdsPercent ?? 2}% of net profit:{" "}
              <strong>−{formatINR(tdsAmount(policy))}</strong>
            </p>
            <p className="text-slate-600">
              Estimated total profit = offer − discount − TDS
            </p>
          </>
        )}
      </Panel>

      <Panel className="mb-6 text-sm">
        <span className="text-slate-500">Points:</span> <strong>{policy.points || 0}</strong>
      </Panel>

      {(policy.customerPayments || []).length ? (
        <Panel className="mb-6 text-sm">
          <h2 className="mb-2 font-semibold">Customer payment split</h2>
          <ul className="space-y-1">
            {policy.customerPayments.map((payment) => <li key={payment.id}>{payment.mode}: <strong>{formatINR(payment.amount)}</strong></li>)}
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
