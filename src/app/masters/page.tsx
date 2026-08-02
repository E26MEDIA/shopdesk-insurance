"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { FormFieldType, MasterType } from "@/lib/types";

const LISTS: { type: MasterType; title: string }[] = [
  { type: "companies", title: "Companies" },
  { type: "portals", title: "Portals" },
  { type: "vehicleModes", title: "Vehicle type" },
  { type: "variants", title: "Variant" },
  { type: "paymentModes", title: "Payment mode" },
];

export default function MastersPage() {
  const {
    data,
    ready,
    addMaster,
    removeMaster,
    updateFormField,
    addCustomFormField,
    removeFormField,
  } = useStore();

  const [listType, setListType] = useState<MasterType>("companies");
  const [listDraft, setListDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldType>("text");

  const formFields = useMemo(
    () => [...(data.formFields || [])].sort((a, b) => a.order - b.order),
    [data.formFields],
  );

  const activeList = data.masters[listType] || [];

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Turn form fields on/off, rename them, and manage dropdown lists"
      />

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Insurance form fields</h2>
        <p className="mb-4 text-sm text-slate-600">
          Tick <strong>Show</strong> to use a field on New insurance. Rename the
          label if you want. Add extra fields at the bottom.
        </p>

        <div className="mb-4 divide-y divide-slate-100 rounded-md border border-slate-200">
          {formFields.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
            >
              <label className="flex items-center gap-2 min-w-[5.5rem]">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  disabled={Boolean(f.locked)}
                  onChange={(e) =>
                    updateFormField(f.id, { enabled: e.target.checked })
                  }
                />
                <span className="text-slate-600">Show</span>
              </label>
              <Input
                className="min-w-[12rem] flex-1"
                value={f.label}
                onChange={(e) =>
                  updateFormField(f.id, { label: e.target.value })
                }
              />
              {f.custom ? (
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => {
                    if (confirm(`Remove “${f.label}”?`)) removeFormField(f.id);
                  }}
                >
                  Remove
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  {f.locked ? "Always on" : f.type}
                </span>
              )}
            </div>
          ))}
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim()) return;
            addCustomFormField({ label: newLabel, type: newType });
            setNewLabel("");
          }}
        >
          <Field label="Add new field">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Policy number"
            />
          </Field>
          <Field label="Type">
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value as FormFieldType)}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="money">Money</option>
              <option value="date">Date</option>
              <option value="textarea">Long text</option>
            </Select>
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </Panel>

      <Panel>
        <h2 className="mb-1 text-base font-semibold">Dropdown lists</h2>
        <p className="mb-4 text-sm text-slate-600">
          Options for Company, Portal, Vehicle type, etc. on the insurance form.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {LISTS.map((l) => (
            <button
              key={l.type}
              type="button"
              onClick={() => {
                setListType(l.type);
                setListDraft("");
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                listType === l.type
                  ? "bg-[#0f3d3e] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {l.title}
            </button>
          ))}
        </div>

        <ul className="mb-3 space-y-1">
          {activeList.length === 0 ? (
            <li className="text-sm text-slate-500">No items yet.</li>
          ) : (
            activeList.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-sm"
              >
                <span>{m.label}</span>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => removeMaster(listType, m.id)}
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!listDraft.trim()) return;
            addMaster(listType, listDraft);
            setListDraft("");
          }}
        >
          <Field
            label={`Add to ${LISTS.find((l) => l.type === listType)?.title}`}
          >
            <Input
              value={listDraft}
              onChange={(e) => setListDraft(e.target.value)}
              placeholder="Type and add"
            />
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </Panel>
    </div>
  );
}
