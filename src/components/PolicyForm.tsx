"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DocumentPack } from "@/components/DocumentPack";
import { Button, Field, Input, Panel, Select, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { DocumentMeta, FormFieldDef, Policy } from "@/lib/types";
import { blankPolicy, offerAmount, policyProfit } from "@/lib/types";
import { isCustomFieldKey } from "@/lib/formFields";
import { formatINR } from "@/lib/utils";

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

  const extraPaid = Math.max(0, (form.payment || 0) - (form.received || 0));
  const offerAmt = offerAmount(form);
  const profit = policyProfit(form as Policy);

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
    if (field.type === "select" && field.masterType) {
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
          placeholder={field.label}
        />
      );
    }

    return (
      <div key={field.id} className={wide ? "sm:col-span-2" : undefined}>
        <Field label={label}>{control}</Field>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Panel className="grid gap-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm text-slate-600">
          Fields below are controlled from Admin (rename, hide, add columns).
          Company offer is in %.
        </p>

        {fields.map(renderField)}

        <div className="rounded-md bg-teal-50 px-3 py-3 text-sm text-[#0f3d3e] sm:col-span-2 space-y-1">
          <p>
            Extra paid by shop (if pay &gt; received):{" "}
            <strong>{formatINR(breakdown.extraPaid)}</strong>
          </p>
          <p>
            Offer from company ({form.companyOfferPercent || 0}% of net
            premium): <strong>{formatINR(breakdown.offerAmt)}</strong>
          </p>
          <p>
            Estimated profit: <strong>{formatINR(breakdown.profit)}</strong>
            <span className="text-slate-600">
              {" "}
              = offer − extra paid (or + surplus if customer paid more)
            </span>
          </p>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Documents
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Upload RC, old insurance, Aadhaar and PAN. Open and check them here.
        </p>
        <DocumentPack
          documents={form.documents}
          clientName={form.clientName}
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
