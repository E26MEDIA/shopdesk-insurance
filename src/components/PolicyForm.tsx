"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DocumentPack } from "@/components/DocumentPack";
import { SearchSelect } from "@/components/SearchSelect";
import { DecimalInput } from "@/components/DecimalInput";
import { Button, Field, Input, Panel, Select, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { CustomerPayment, DocumentMeta, FormFieldDef, Policy } from "@/lib/types";
import {
  blankPolicy,
  CREDIT_MODE,
  collectedFromCustomer,
  customerCredit,
  autoInsExtraPo,
  extraPaidAmount,
  insExtraPoAmount,
  isCreditPayment,
  offerAmount,
  policyProfit,
  tdsAmount,
  totalProfitWithExtra,
  usesPointsProfit,
} from "@/lib/types";
import { isCustomFieldKey } from "@/lib/formFields";
import { appAlert } from "@/lib/appDialog";
import { documentLabel, formatINR, phoneDigits, phoneError, uid, vehicleNumberError } from "@/lib/utils";

type FormState = Omit<Policy, "id" | "createdAt">;

function cashPayments(parts: CustomerPayment[] | undefined): CustomerPayment[] {
  return (parts || []).filter((item) => !isCreditPayment(item.mode));
}

function creditPayment(parts: CustomerPayment[] | undefined): CustomerPayment | undefined {
  return (parts || []).find((item) => isCreditPayment(item.mode));
}

function listedName(options: { label: string }[], typed: string): string {
  const text = typed.trim().toLowerCase();
  if (!text) return "";
  return options.find((item) => item.label.trim().toLowerCase() === text)?.label || "";
}

function cashTotalOf(parts: CustomerPayment[] | undefined): number {
  return cashPayments(parts).reduce((sum, item) => sum + (item.amount || 0), 0);
}

function seedReceivedSplit(base: FormState): CustomerPayment[] {
  const cash = cashPayments(base.customerPayments);
  const rows = cash.length
    ? cash
    : [
        {
          id: uid("pay"),
          mode:
            base.paymentMode && !isCreditPayment(base.paymentMode)
              ? base.paymentMode.split(" + ")[0] || "Cash"
              : "Cash",
          amount: base.received || 0,
        },
      ];
  const bill = base.customerSidePayment || 0;
  const leftover = Math.max(0, bill - cashTotalOf(rows));
  const existingCredit = creditPayment(base.customerPayments);
  const creditAmount = existingCredit?.amount || leftover;
  if (creditAmount > 0) {
    return [
      ...rows,
      { id: existingCredit?.id || uid("pay"), mode: CREDIT_MODE, amount: creditAmount },
    ];
  }
  return rows;
}

function withCreditLine(parts: CustomerPayment[], bill: number): CustomerPayment[] {
  const cash = cashPayments(parts);
  const cashTotal = cashTotalOf(cash);
  const existingCredit = creditPayment(parts);
  const effectiveBill = bill > 0 ? bill : cashTotal + (existingCredit?.amount || 0);
  const leftover = Math.max(0, effectiveBill - cashTotal);
  if (leftover <= 0) return cash;
  return [
    ...cash,
    { id: existingCredit?.id || uid("pay"), mode: CREDIT_MODE, amount: leftover },
  ];
}

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
  const savingRef = useRef(false);
  const insExtraManual = useRef(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => {
    const base = initial || blankPolicy();
    const pct =
      base.companyOfferPercent ||
      (base.companyOffer && base.companyOffer <= 100 ? base.companyOffer : 0) ||
      0;
    const payments = seedReceivedSplit(base);
    const autoExtra = autoInsExtraPo(base.customerSidePayment || 0, base.payment || 0);
    const storedExtra = base.insExtraPo || 0;
    insExtraManual.current =
      storedExtra > 0 && (autoExtra === null || storedExtra !== autoExtra);
    return {
      ...base,
      companyOfferPercent: pct,
      confirmed: base.confirmed ?? false,
      customFields: { ...(base.customFields || {}) },
      customerPayments: payments,
      received: cashTotalOf(payments),
      insExtraPo: insExtraManual.current ? storedExtra : autoExtra ?? storedExtra,
    };
  });

  const fields = useMemo(
    () =>
      [...(data.formFields || [])]
        .filter(
          (f) =>
            f.enabled &&
            !["paymentMode", "received", "customerSidePayment"].includes(f.key),
        )
        .sort((a, b) => a.order - b.order),
    [data.formFields],
  );

  const extraPaid = extraPaidAmount(form);
  const collected = collectedFromCustomer(form);
  const credit = customerCredit(form);
  const offerAmt = offerAmount(form);
  const tds = tdsAmount(form);
  const profit = policyProfit(form as Policy);
  const insExtra = insExtraPoAmount(form);
  const totalProfit = totalProfitWithExtra(form as Policy);
  const pointsMode = usesPointsProfit(form);


  function setBuiltin<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setFieldValue(field: FormFieldDef, raw: string) {
    if (isCustomFieldKey(field.key)) {
      const next = field.type === "text" || field.type === "textarea" ? raw.toUpperCase() : raw;
      setForm((f) => ({
        ...f,
        customFields: { ...(f.customFields || {}), [field.key]: next },
      }));
      return;
    }

    if (field.key === "phone") {
      setForm((f) => ({ ...f, phone: phoneDigits(raw) }));
      return;
    }

    if (field.type === "text" || field.type === "textarea") {
      setForm((f) => ({ ...f, [field.key]: raw.toUpperCase() } as FormState));
      return;
    }

    if (field.type === "money" || field.type === "percent" || field.type === "number") {
      const cleaned = raw.replace(/[^\d.]/g, "");
      const num = cleaned === "" ? 0 : Number(cleaned) || 0;
      if (field.key === "insExtraPo") insExtraManual.current = true;
      if (field.key === "payment") insExtraManual.current = false;
      setForm((f) => {
        const next = { ...f, [field.key]: num } as FormState;
        if (field.key === "payment" && !insExtraManual.current) {
          const autoExtra = autoInsExtraPo(next.customerSidePayment || 0, next.payment || 0);
          if (autoExtra !== null) next.insExtraPo = autoExtra;
        }
        return next;
      });
      return;
    }

    setForm((f) => ({ ...f, [field.key]: raw } as FormState));
  }

  function save(e?: { preventDefault?: () => void }, mode: "draft" | "confirm" = "draft") {
    e?.preventDefault?.();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    if (!form.clientName.trim() || !form.regNo.trim()) {
      savingRef.current = false;
      setSaving(false);
      void appAlert("Enter client name and vehicle registration number.", "Save insurance");
      return;
    }
    const vehicleProblem = form.regNo.trim() ? vehicleNumberError(form.regNo) : "";
    if (vehicleProblem) {
      savingRef.current = false;
      setSaving(false);
      void appAlert(vehicleProblem, "Save insurance");
      return;
    }
    const phoneProblem = form.phone.trim() ? phoneError(form.phone) : "";
    if (phoneProblem) {
      savingRef.current = false;
      setSaving(false);
      void appAlert(phoneProblem, "Save insurance");
      return;
    }
    for (const field of fields) {
      if (!field.required) continue;
      const val = getFieldValue(form, field).trim();
      if (!val) {
        savingRef.current = false;
        setSaving(false);
        void appAlert(`Please fill: ${field.label}`, "Save insurance");
        return;
      }
    }
    const portalName = listedName(data.masters.portals || [], form.portal);
    const companyName = listedName(data.masters.companies || [], form.company);
    if (form.portal.trim() && !portalName) {
      savingRef.current = false;
      setSaving(false);
      void appAlert(
        `“${form.portal.trim()}” is not in the portal list. Choose a portal from the dropdown.`,
        "Save insurance",
      );
      return;
    }
    if (form.company.trim() && !companyName) {
      savingRef.current = false;
      setSaving(false);
      void appAlert(
        `“${form.company.trim()}” is not in the company list. Choose a company from the dropdown.`,
        "Save insurance",
      );
      return;
    }
    const cashParts = cashPayments(form.customerPayments).filter(
      (item) => item.mode && item.amount > 0,
    );
    const cashTotal = cashParts.reduce((sum, item) => sum + item.amount, 0);
    const namedCredit = creditPayment(form.customerPayments)?.amount || 0;
    const billAmount =
      form.customerSidePayment > 0
        ? form.customerSidePayment
        : cashTotal + namedCredit || form.received;
    const nextParts = withCreditLine(cashParts, billAmount);
    const receivedCash = cashTotalOf(nextParts);
    const payload: FormState = {
      ...form,
      clientName: form.clientName.trim().toUpperCase(),
      phone: phoneDigits(form.phone),
      contact: form.contact.trim().toUpperCase(),
      regNo: form.regNo.trim().toUpperCase(),
      rcNumber: form.rcNumber.trim().toUpperCase(),
      description: form.description.trim().toUpperCase(),
      variant: form.variant.trim().toUpperCase(),
      portal: portalName,
      company: companyName,
      pendingNotes: form.pendingNotes.trim().toUpperCase(),
      discount: extraPaid,
      companyOffer: form.companyOfferPercent,
      customerSidePayment: billAmount,
      received: receivedCash,
      paymentMode: nextParts.length
        ? [...new Set(nextParts.map((item) => item.mode))].join(" + ")
        : form.paymentMode,
      customerPayments: nextParts,
      customFields: { ...(form.customFields || {}) },
      confirmed: mode === "confirm" ? true : Boolean(policyId && form.confirmed),
    };
    try {
      if (policyId) updatePolicy(policyId, payload);
      else addPolicy(payload);
      router.push("/insurance");
    } catch (err) {
      console.error(err);
      savingRef.current = false;
      setSaving(false);
      void appAlert("Could not save. Please try again.", "Save insurance");
    }
  }

  const breakdown = useMemo(
    () => ({
      extraPaid,
      offerAmt,
      profit,
      insExtra,
      totalProfit,
    }),
    [extraPaid, offerAmt, profit, insExtra, totalProfit],
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
              ? "Choose company"
              : field.key === "vehicleMode"
                ? "Search vehicle mode"
                : "Choose portal"
          }
          strict={field.key === "portal" || field.key === "company"}
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
        <DecimalInput
          required={field.required}
          maxDecimals={field.type === "percent" ? 4 : 2}
          value={Number(value) || 0}
          onValue={(num) => {
            if (isCustomFieldKey(field.key)) {
              setForm((f) => ({
                ...f,
                customFields: { ...(f.customFields || {}), [field.key]: String(num) },
              }));
              return;
            }
            if (field.key === "insExtraPo") insExtraManual.current = true;
            if (field.key === "payment") insExtraManual.current = false;
            setForm((f) => {
              const next = { ...f, [field.key]: num } as FormState;
              if (field.key === "payment") {
                const autoExtra = autoInsExtraPo(next.customerSidePayment || 0, num);
                if (autoExtra !== null) next.insExtraPo = autoExtra;
              }
              return next;
            });
          }}
          placeholder={
            field.type === "percent"
              ? "e.g. 4.5"
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

    const moneyClass =
      field.key === "payment"
        ? "rounded-md border border-yellow-600 p-2 text-yellow-950"
        : field.key === "received" || field.key === "customerSidePayment"
          ? "rounded-md border border-green-700 p-2 text-green-950"
          : "";
    const digits = field.key === "phone" ? phoneDigits(value) : "";
    const fieldError =
      field.key === "phone" && digits.length > 0 && digits.length !== 10
        ? phoneError(value)
        : field.key === "regNo" && value.trim()
          ? vehicleNumberError(value)
          : "";

    return (
      <div key={field.id} className={wide ? "sm:col-span-2" : undefined}>
        <div className={moneyClass}>
          <Field label={label}>{control}</Field>
        </div>
        {fieldError ? <p className="mt-1 text-xs text-red-700">{fieldError}</p> : null}
      </div>
    );
  }

  function setCustomerPayments(next: CustomerPayment[], bill?: number) {
    setForm((f) => {
      const nextBill = typeof bill === "number" ? bill : f.customerSidePayment;
      const cash = cashPayments(next);
      const rows = cash.length
        ? cash
        : [{ id: uid("pay"), mode: "Cash", amount: 0 }];
      const synced = withCreditLine(rows, nextBill);
      let insExtraPo = f.insExtraPo;
      if (typeof bill === "number") {
        insExtraManual.current = false;
        const autoExtra = autoInsExtraPo(nextBill, f.payment || 0);
        if (autoExtra !== null) insExtraPo = autoExtra;
      }
      return {
        ...f,
        customerSidePayment: nextBill,
        customerPayments: synced,
        received: cashTotalOf(synced),
        insExtraPo,
      };
    });
  }

  function setCustomerSidePayment(amount: number) {
    setCustomerPayments(form.customerPayments || [], amount);
  }

  function setCreditAmount(amount: number) {
    const cash = cashPayments(form.customerPayments);
    const existing = creditPayment(form.customerPayments);
    const next =
      amount > 0
        ? [...cash, { id: existing?.id || uid("pay"), mode: CREDIT_MODE, amount }]
        : cash;
    setForm((f) => ({
      ...f,
      customerPayments: next,
      received: cashTotalOf(next),
    }));
  }

  function updateCustomerPayment(id: string, patch: Partial<CustomerPayment>) {
    setCustomerPayments(
      cashPayments(form.customerPayments).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  const methodOptions = useMemo(
    () => (data.masters.paymentModes || []).filter((item) => !isCreditPayment(item.label)),
    [data.masters.paymentModes],
  );

  const receivedRows = cashPayments(form.customerPayments);
  const creditRow = creditPayment(form.customerPayments);

  return (
    <form
      onSubmit={save}
      noValidate
      className="space-y-6"
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        const target = event.target as HTMLElement | null;
        if (!target || target.tagName === "TEXTAREA") return;
        if (target.closest("[data-file-picker]")) return;
        if (target instanceof HTMLButtonElement && target.type === "submit") return;
        event.preventDefault();
      }}
    >
      <Panel className="grid gap-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm text-slate-600">
          Two profit paths: net premium × company offer % is company profit
          (decimals such as 4.5% are fine). TDS and the discount both come off
          that company profit. That result is the estimated profit. Ins Extra PO is
          a small extra from the customer and is added only in the last total
          profit. Or leave net premium blank and enter direct profit in Points.
          Portal and company must be chosen from the dropdown. Variant stays a blank type-in.
          Green is money coming in. Yellow is money going out.
        </p>

        {fields.filter((f) => f.order < 135).map(renderField)}

        <div className="rounded-md border border-green-700 p-3 text-green-950 sm:col-span-2">
          <p className="font-semibold text-green-950">Customer side payment <span className="text-xs font-medium">Incoming</span></p>
          <p className="mb-3 text-xs text-slate-600">
            Enter what the customer pays and what you pay the company. The difference is Ins Extra PO. Example: customer 970 and company 950 fills Ins Extra PO as 20. Type a different Ins Extra PO only if you need to.
          </p>
          <Field label="Customer side payment">
            <Input
              inputMode="decimal"
              className="no-spin"
              value={form.customerSidePayment || ""}
              onChange={(e) =>
                setCustomerSidePayment(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)
              }
              placeholder="How much the customer has to pay"
            />
          </Field>
        </div>

        <div className="rounded-md border border-green-700 p-3 text-sm text-green-950 sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-green-950">Received from customer <span className="text-xs font-medium">Incoming</span></p>
              <p className="text-xs text-slate-600">
                Split only here: Cash, UPI, Card, then Credit as the unpaid add-on. Credit is highlighted in red.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="!py-1 text-xs"
              onClick={() =>
                setCustomerPayments([
                  ...receivedRows,
                  { id: uid("pay"), mode: "Cash", amount: 0 },
                ])
              }
            >
              Add payment method
            </Button>
          </div>
          <div className="space-y-2">
            {receivedRows.map((item) => (
              <div key={item.id} className="flex flex-wrap items-end gap-2 rounded-md bg-white p-2">
                <Field label="Payment method">
                  <Select
                    value={item.mode}
                    onChange={(e) => updateCustomerPayment(item.id, { mode: e.target.value })}
                  >
                    <option value="">Select</option>
                    {methodOptions.map((mode) => (
                      <option key={mode.id} value={mode.label}>
                        {mode.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input
                    inputMode="decimal"
                    className="no-spin"
                    value={item.amount || ""}
                    onChange={(e) =>
                      updateCustomerPayment(item.id, {
                        amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
                      })
                    }
                    placeholder="How much was received"
                  />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1 text-xs"
                  onClick={() =>
                    setCustomerPayments(receivedRows.filter((payment) => payment.id !== item.id))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <div
              className={`flex flex-wrap items-end gap-2 rounded-md border p-2 ${
                credit > 0 ? "border-red-300" : "border-slate-200"
              }`}
            >
              <Field label="Payment method">
                <Input
                  readOnly
                  value="Credit"
                  className={credit > 0 ? "border-red-300 font-semibold text-red-800" : "text-slate-700"}
                />
              </Field>
              <Field label="Amount">
                <Input
                  inputMode="decimal"
                  className={`no-spin ${credit > 0 ? "border-red-300 font-semibold text-red-800" : ""}`}
                  value={creditRow?.amount || ""}
                  onChange={(e) =>
                    setCreditAmount(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)
                  }
                  placeholder="Unpaid leftover"
                />
              </Field>
              <p className={`max-w-xs pb-2 text-xs ${credit > 0 ? "font-semibold text-red-700" : "text-slate-500"}`}>
                Credit add-on — leftover of customer side minus received. Highlighted in red.
              </p>
            </div>
            <p className="text-sm text-[#0f3d3e]">
              Received: <strong>{formatINR(collected)}</strong>
              {credit > 0 ? (
                <>
                  {" "}
                  · <span className="font-semibold text-red-700">Credit: {formatINR(credit)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {fields.filter((f) => f.order >= 135).map(renderField)}

        <div className="space-y-1 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm sm:col-span-2">
          <p className="rounded-md border border-emerald-300 px-2 py-1 font-semibold text-emerald-900">
            Pending profit — {pointsMode ? "Company profit (points)" : `Company profit (${form.companyOfferPercent || 0}% of net premium)`}
            : {formatINR(pointsMode ? form.points || 0 : breakdown.offerAmt)}
            <span className="ml-2 text-xs font-medium">Incoming</span>
          </p>
          <p className="rounded-md border border-amber-300 px-2 py-1 font-semibold text-amber-900">
            TDS ({form.tdsPercent || 0}% of company profit): −{formatINR(tds)}
            <span className="ml-2 text-xs font-medium">Outgoing</span>
          </p>
          <p className="rounded-md border border-amber-300 px-2 py-1 font-semibold text-amber-900">
            Discount (extra paid to company): −{formatINR(breakdown.extraPaid)}
            <span className="ml-2 text-xs font-medium">Outgoing</span>
          </p>
          {credit > 0 ? (
            <p className="rounded-md border border-red-300 px-2 py-1 font-semibold text-red-900">
              Customer credit: {formatINR(credit)}
            </p>
          ) : null}
          <p className="rounded-md border border-emerald-300 px-2 py-1 font-semibold text-emerald-900">
            Pending profit after TDS / discount: {formatINR(breakdown.profit)}
            <span className="ml-2 text-xs font-medium">received later from company</span>
          </p>
          <p className="rounded-md border border-emerald-200 px-2 py-1 font-medium text-emerald-900">
            Received profit — Ins Extra PO: {formatINR(breakdown.insExtra)}
          </p>
          <p className="rounded-md border border-emerald-300 px-2 py-2 text-lg font-bold text-emerald-900">
            Total profit: {formatINR(breakdown.totalProfit)}
            <span className="ml-2 text-xs font-medium">= received profit + pending profit</span>
          </p>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Documents
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Upload {documentLabel(data.documentLabels, "rc")}, {documentLabel(data.documentLabels, "old_insurance")}, {documentLabel(data.documentLabels, "aadhaar")}, {documentLabel(data.documentLabels, "pan")}, and {documentLabel(data.documentLabels, "fresh_policy")} with the + button.
          {documentLabel(data.documentLabels, "aadhaar")} and {documentLabel(data.documentLabels, "pan")} sit together. Add any extra paper under Add other
          document (give it a name first).
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

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : policyId ? "Save changes" : "Save insurance"}
        </Button>
        <Button type="button" disabled={saving} onClick={() => save(undefined, "confirm")}>
          Confirm insurance
        </Button>
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
