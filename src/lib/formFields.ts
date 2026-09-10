/** Shared form-field definitions for insurance add/edit (Admin-customizable). */

import type { FormFieldDef, MasterType } from "./types";

export const DEFAULT_FORM_FIELDS: FormFieldDef[] = [
  {
    id: "f_clientName",
    key: "clientName",
    label: "Client name",
    type: "text",
    enabled: true,
    required: true,
    locked: true,
    order: 10,
  },
  {
    id: "f_phone",
    key: "phone",
    label: "Phone",
    type: "text",
    enabled: true,
    required: false,
    order: 20,
  },
  {
    id: "f_contact",
    key: "contact",
    label: "Contact",
    type: "text",
    enabled: true,
    required: false,
    order: 30,
  },
  {
    id: "f_regNo",
    key: "regNo",
    label: "Vehicle registration number",
    type: "text",
    enabled: true,
    required: true,
    locked: true,
    order: 40,
  },
  {
    id: "f_rcNumber",
    key: "rcNumber",
    label: "RC number",
    type: "text",
    enabled: true,
    required: false,
    order: 50,
  },
  {
    id: "f_date",
    key: "date",
    label: "Date",
    type: "date",
    enabled: true,
    required: true,
    locked: true,
    order: 60,
  },
  {
    id: "f_expiryDate",
    key: "expiryDate",
    label: "Expiry / renewal date",
    type: "date",
    enabled: true,
    required: false,
    order: 70,
  },
  {
    id: "f_description",
    key: "description",
    label: "Description",
    type: "text",
    enabled: true,
    required: false,
    order: 80,
  },
  {
    id: "f_vehicleMode",
    key: "vehicleMode",
    label: "Model (vehicle mode)",
    type: "text",
    enabled: true,
    required: false,
    order: 90,
  },
  {
    id: "f_variant",
    key: "variant",
    label: "Variant",
    type: "text",
    enabled: true,
    required: false,
    order: 100,
  },
  {
    id: "f_portal",
    key: "portal",
    label: "Portal",
    type: "select",
    enabled: true,
    required: false,
    masterType: "portals" as MasterType,
    order: 110,
  },
  {
    id: "f_company",
    key: "company",
    label: "Company",
    type: "select",
    enabled: true,
    required: false,
    masterType: "companies" as MasterType,
    order: 120,
  },
  {
    id: "f_paymentMode",
    key: "paymentMode",
    label: "Payment mode",
    type: "select",
    enabled: true,
    required: false,
    masterType: "paymentModes" as MasterType,
    order: 130,
  },
  {
    id: "f_received",
    key: "received",
    label: "Received from customer",
    type: "money",
    enabled: true,
    required: false,
    order: 140,
  },
  {
    id: "f_payment",
    key: "payment",
    label: "We pay company",
    type: "money",
    enabled: true,
    required: false,
    order: 150,
  },
  {
    id: "f_netPremium",
    key: "netPremium",
    label: "Net premium (from company portal)",
    type: "money",
    enabled: true,
    required: false,
    order: 160,
  },
  {
    id: "f_companyOfferPercent",
    key: "companyOfferPercent",
    label: "Company offer (%)",
    type: "percent",
    enabled: true,
    required: false,
    order: 170,
  },
  {
    id: "f_tdsPercent",
    key: "tdsPercent",
    label: "TDS (%)",
    type: "percent",
    enabled: true,
    required: false,
    order: 175,
  },
  {
    id: "f_points",
    key: "points",
    label: "Direct profit / points",
    type: "money",
    enabled: true,
    required: false,
    order: 177,
  },
  {
    id: "f_pendingNotes",
    key: "pendingNotes",
    label: "Pending notes",
    type: "textarea",
    enabled: true,
    required: false,
    order: 180,
  },
];

export function mergeFormFields(
  saved?: FormFieldDef[] | null,
): FormFieldDef[] {
  const defaults = structuredClone(DEFAULT_FORM_FIELDS);
  if (!saved?.length) return defaults;

  const byId = new Map(saved.map((f) => [f.id, f]));
  const byKey = new Map(saved.map((f) => [f.key, f]));

  const merged: FormFieldDef[] = defaults.map((d) => {
    const override = byId.get(d.id) || byKey.get(d.key);
    if (!override) return d;
    const merged: FormFieldDef = {
      ...d,
      ...override,
      id: d.id,
      key: d.key,
      locked: d.locked,
      masterType: d.masterType || override.masterType,
      custom: false,
    };
    if (d.key === "vehicleMode" || d.key === "variant") {
      return { ...merged, type: "text", masterType: undefined };
    }
    return merged;
  });

  const knownKeys = new Set(merged.map((f) => f.key));
  const knownIds = new Set(merged.map((f) => f.id));
  for (const f of saved) {
    if (f.custom && !knownKeys.has(f.key) && !knownIds.has(f.id)) {
      merged.push({
        ...f,
        custom: true,
        enabled: f.enabled !== false,
        required: Boolean(f.required),
        type: f.type || "text",
        order: typeof f.order === "number" ? f.order : 900,
      });
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}

export function isCustomFieldKey(key: string): boolean {
  return key.startsWith("custom_");
}
