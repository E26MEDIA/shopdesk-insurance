"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DocumentPack } from "@/components/DocumentPack";
import { SearchSelect } from "@/components/SearchSelect";
import { Button, Field, Input, Panel, Select, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { CustomerPayment, DocumentMeta, FormFieldDef, Policy } from "@/lib/types";
import {
  blankPolicy,
  customerBalanceDue,
  extraPaidAmount,
  offerAmount,
  policyProfit,
  tdsAmount,
  usesPointsProfit,
} from "@/lib/types";
import { isCustomFieldKey } from "@/lib/formFields";
import { formatINR, uid } from "@/lib/utils";

type FormState = Omit<Policy, "id" | "createdAt">;

function getFieldValue(form: FormState, field: FormFieldDef): string {
  if (isCustomFieldKey(field.key)) {
    return form.customFields?.[field.key] ?? "";
  }
  const raw = (form as unknown as Record<string, unknown>)[field.key];
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "number") return raw === 0 ? "" : String(raw);
  return String(raw);
}

export function PolicyForm({
  initial,
  policyId,
  onSaved,
}: {
  initial?: FormState;
  policyId?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const { data, addPolicy, updatePolicy } = useStore();
  const [form, setForm] = useState<FormState>(() => {
    const base = initial || blankPolicy();
    const pct =
      base.companyOfferPercent ||
      (base.companyOffer && base.companyOffer <= 100 ? base.companyOffer : 0) ||
      0;
    return {
      ...base,
      companyOfferPercent: pct,
      confirmed: base.confirmed ?? false,
      customFields: { ...(base.customFields || {}) },
    };
  });

  const fields = useMemo(
    () =>
      [...(data.formFields || [])]
        .filter((f) => f.enabled)
        .sort((a, b) => a.order - b.order),
    [data.formFields],
  );

  const extraPaid = extraPaidAmount(form);
  const balanceDue = customerBalanceDue(form);
  const offerAmt = offerAmount(form);
  const tds = tdsAmount(form);
  const profit = policyProfit(form as Policy);
  const pointsMode = usesPointsProfit(form);
  const customerPaymentTotal = (form.customerPayments || []).reduce((sum, item) => sum + (item.amount || 0), 0);

  function setBuiltin<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setFieldValue(field: FormFieldDef, raw: string) {
    if (isCustomFieldKey(field.key)) {
      setForm((f) => ({
        ...f,
        customFields: { ...(f.customFields || {}), [field.key]: raw },
      }));
      return;
    }

    if (field.type === "money" || field.type === "percent" || field.type === "number") {
      const cleaned = raw.replace(/[^\d.]/g, "");
      const num = cleaned === "" ? 0 : Number(cleaned) || 0;
      setForm((f) => ({ ...f, [field.key]: num } as FormState));
      return;
    }

    setForm((f) => ({ ...f, [field.key]: raw } as FormState));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim() || !form.regNo.trim()) {
      alert("Enter client name and vehicle registration number.");
      return;
    }
    for (const field of fields) {
      if (!field.required) continue;
      const val = getFieldValue(form, field).trim();
      if (!val) {
        alert(`Please fill: ${field.label}`);
        return;
      }
    }
    const paymentParts = (form.customerPayments || []).filter((item) => item.mode && item.amount > 0);
    const payload: FormState = {
      ...form,
      clientName: form.clientName.trim(),
      phone: form.phone.trim(),
      contact: form.contact.trim(),
      regNo: form.regNo.trim().toUpperCase(),
      rcNumber: form.rcNumber.trim(),
      description: form.description.trim(),
      discount: extraPaid,
      companyOffer: form.companyOfferPercent,
      received: paymentParts.length ? paymentParts.reduce((sum, item) => sum + item.amount, 0) : form.received,
      paymentMode: paymentParts.length ? [...new Set(paymentParts.map((item) => item.mode))].join(" + ") : form.paymentMode,
      customerPayments: paymentParts,
      customFields: { ...(form.customFields || {}) },
      confirmed: policyId ? Boolean(form.confirmed) : false,
    };
    try {
      if (policyId) {
        updatePolicy(policyId, payload);
        if (onSaved) onSaved();
        else router.push(`/insurance/${policyId}`);
      } else {
        const p = addPolicy(payload);
        router.push(`/insurance/${p.id}`);
      }
    } catch (err) {
      console.error(err);
      alert("Could not save. Please try again.");
    }
  }

  const breakdown = useMemo(
    () => ({
      extraPaid,
      offerAmt,
      profit,
    }),
    [extraPaid, offerAmt, profit],
  );

  function renderField(field: FormFieldDef) {
    const value = getFieldValue(form, field);
    const label = field.required ? `${field.label} *` : field.label;
    const wide = field.type === "textarea";

    let control: ReactNode = null;
    const typeInKeys = field.key === "variant";
    if (
      field.key === "company" ||
      field.key === "vehicleMode" ||
      field.key === "portal"
    ) {
      const masterType = field.masterType ||
        (field.key === "company"
          ? "companies"
          : field.key === "vehicleMode"
            ? "vehicleModes"
            : "portals");
      control = (
        <SearchSelect
          required={field.required}
          value={value}
          options={data.masters[masterType] || []}
          placeholder={
            field.key === "company"
              ? "Search company"
              : field.key === "vehicleMode"
                ? "Search vehicle mode"
                : "Search portal"
          }
          onChange={(next) => setFieldValue(field, next)}
        />
      );
    } else if (!typeInKeys && field.type === "select" && field.masterType) {
      const options = data.masters[field.masterType] || [];
      control = (
        <Select
          required={field.required}
          value={value}
          onChange={(e) => setFieldValue(field, e.target.value)}
        >
          <option value="">Select / leave blank</option>
          {options.map((m) => (
            <option key={m.id} value={m.label}>
              {m.label}
            </option>
          ))}
        </Select>
      );
    } else if (field.type === "textarea") {
      control = (
        <Textarea
          required={field.required}
          value={value}
          onChange={(e) => setFieldValue(field, e.target.value)}
          placeholder={field.label}
        />
      );
    } else if (field.type === "date") {
      control = (
        <Input
          type="date"
          required={field.required}
          value={value}
          onChange={(e) => setFieldValue(field, e.target.value)}
        />
      );
    } else if (
      field.type === "money" ||
      field.type === "percent" ||
      field.type === "number"
    ) {
      control = (
        <Input
          inputMode="decimal"
          className="no-spin"
          required={field.required}
          value={value}
          onChange={(e) => setFieldValue(field, e.target.value)}
          placeholder={
            field.type === "percent"
              ? "e.g. 7"
              : field.type === "money"
                ? "e.g. 10500"
                : undefined
          }
        />
      );
    } else {
      control = (
        <Input
          required={field.required}
          value={value}
          onChange={(e) => setFieldValue(field, e.target.value)}
          placeholder={
            field.key === "variant" ? "Type variant" : field.label
          }
        />
      );
    }

    return (
      <div key={field.id} className={wide ? "sm:col-span-2" : undefined}>
        <Field label={label}>{control}</Field>
      </div>
    );
  }

  function updateCustomerPayment(id: string, patch: Partial<CustomerPayment>) {
    setBuiltin("customerPayments", (form.customerPayments || []).map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Panel className="grid gap-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm text-slate-600">
          Two profit paths: net premium × company offer % is company profit;
          TDS % comes off that company profit; then discount (extra you paid).
          Or leave net premium blank and enter direct profit in Points — TDS
          comes off points, then discount. Search to pick vehicle mode, portal
          and company. Variant stays a blank type-in.
        </p>

        {fields.map(renderField)}

        {balanceDue > 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
            <p className="font-semibold">
              This will go to credit / balance due: {formatINR(balanceDue)}
            </p>
            <p className="mt-1">
              Customer paid {formatINR(form.received)} · we pay company {formatINR(form.payment)}.
              The remaining amount stays as unpaid credit on this customer (shown in red on Reports and details).
            </p>
          </div>
        ) : null}

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">Customer payment split</p>
              <p className="text-xs text-slate-600">Use this when the customer pays by more than one method. The total becomes “Received from customer”.</p>
            </div>
            <Button type="button" variant="secondary" className="!py-1 text-xs" onClick={() => setBuiltin("customerPayments", [...(form.customerPayments || []), { id: uid("pay"), mode: "Cash", amount: 0 }])}>
              Add payment method
            </Button>
          </div>
          {(form.customerPayments || []).length ? (
            <div className="space-y-2">
              {(form.customerPayments || []).map((item) => (
                <div key={item.id} className="flex flex-wrap items-end gap-2">
                  <Field label="Mode">
                    <Select value={item.mode} onChange={(e) => updateCustomerPayment(item.id, { mode: e.target.value })}>
                      <option value="">Select</option>
                      {(data.masters.paymentModes || []).map((mode) => <option key={mode.id} value={mode.label}>{mode.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Amount">
                    <Input inputMode="decimal" className="no-spin" value={item.amount || ""} onChange={(e) => updateCustomerPayment(item.id, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} placeholder="0" />
                  </Field>
                  <Button type="button" variant="secondary" className="!py-1 text-xs" onClick={() => setBuiltin("customerPayments", (form.customerPayments || []).filter((payment) => payment.id !== item.id))}>Remove</Button>
                </div>
              ))}
              <p className="text-sm text-[#0f3d3e]">Split total: <strong>{formatINR(customerPaymentTotal)}</strong>{form.received !== customerPaymentTotal ? " · This will replace the Received amount when saved." : ""}</p>
            </div>
          ) : <p className="text-xs text-slate-500">No split added. Use the normal Payment mode and Received fields above.</p>}
        </div>

        <div className="rounded-md bg-teal-50 px-3 py-3 text-sm text-[#0f3d3e] sm:col-span-2 space-y-1">
          {pointsMode ? (
            <>
              <p>
                Company profit (points):{" "}
                <strong>{formatINR(form.points || 0)}</strong>
              </p>
              <p>
                TDS ({form.tdsPercent || 0}% of company profit):{" "}
                <strong>−{formatINR(tds)}</strong>
              </p>
              <p>
                Discount (extra paid if we pay more than customer):{" "}
                <strong>−{formatINR(breakdown.extraPaid)}</strong>
              </p>
              {balanceDue > 0 ? (
                <p className="font-semibold text-red-700">
                  Goes to credit / balance due: {formatINR(balanceDue)}
                </p>
              ) : null}
              <p>
                Estimated total profit: <strong>{formatINR(breakdown.profit)}</strong>
                <span className="text-slate-600"> = company profit − TDS − discount</span>
              </p>
            </>
          ) : (
            <>
              <p>
                Company profit ({form.companyOfferPercent || 0}% of net
                premium): <strong>{formatINR(breakdown.offerAmt)}</strong>
              </p>
              <p>
                TDS ({form.tdsPercent || 0}% of company profit):{" "}
                <strong>−{formatINR(tds)}</strong>
              </p>
              <p>
                Discount (extra paid if we pay more than customer):{" "}
                <strong>−{formatINR(breakdown.extraPaid)}</strong>
              </p>
              {balanceDue > 0 ? (
                <p className="font-semibold text-red-700">
                  Goes to credit / balance due: {formatINR(balanceDue)}
                </p>
              ) : null}
              <p>
                Estimated total profit: <strong>{formatINR(breakdown.profit)}</strong>
                <span className="text-slate-600">
                  {" "}
                  = company profit − TDS − discount
                </span>
              </p>
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Documents
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Upload RC, old insurance, Aadhaar and PAN with the + button. Add any
          extra paper under Add other document (give it a name first).
        </p>
        <DocumentPack
          documents={form.documents}
          clientName={form.clientName}
          variant={form.variant}
          vehicleMode={form.vehicleMode}
          portal={form.portal}
          onChange={(documents: DocumentMeta[]) =>
            setBuiltin("documents", documents)
          }
        />
      </Panel>

      <div className="flex gap-2">
        <Button type="submit">{policyId ? "Save changes" : "Save insurance"}</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (onSaved) onSaved();
            else if (policyId) router.push(`/insurance/${policyId}`);
            else router.push("/insurance");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
