"use client";

import { useState } from "react";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Advance } from "@/lib/types";
import { formatDDMMYY, formatINR, todayISO } from "@/lib/utils";

export default function AdvancesPage() {
  const { data, ready, addAdvance, deleteAdvance } = useStore();
  const [kind, setKind] = useState<Advance["kind"]>("insurance");
  const [date, setDate] = useState(todayISO());
  const [regNo, setRegNo] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Advances"
        subtitle="Insurance advance or endorsement advance. Vehicle number, phone and description are saved in capital letters."
      />
      <Panel className="mb-6">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!regNo.trim() || phone.replace(/\D/g, "").length !== 10 || !description.trim()) {
              setNote("Enter vehicle number, a 10-digit phone number, and a description.");
              return;
            }
            addAdvance({
              date,
              kind,
              regNo,
              phone,
              description,
              amount: Number(amount) || 0,
            });
            setRegNo("");
            setPhone("");
            setDescription("");
            setAmount("");
            setNote("Advance saved.");
          }}
        >
          <Field label="Advance type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as Advance["kind"])}>
              <option value="insurance">Insurance advance</option>
              <option value="endorsement">Endorsement advance</option>
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Vehicle number *">
            <Input value={regNo} onChange={(e) => setRegNo(e.target.value.toUpperCase())} placeholder="KA01AB1234" />
          </Field>
          <Field label="Phone *">
            <Input
              inputMode="numeric"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10 digits"
            />
          </Field>
          <Field label="Amount">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description *">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value.toUpperCase())}
                placeholder="ENDORSEMENT ADVANCE"
              />
            </Field>
          </div>
          <div>
            <Button type="submit">Save advance</Button>
          </div>
        </form>
        {note ? <p className="mt-3 text-sm text-[#0f3d3e]">{note}</p> : null}
      </Panel>
      {(data.advances || []).length === 0 ? (
        <p className="text-sm text-slate-600">No advances yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(data.advances || []).map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{formatDDMMYY(entry.date) || entry.date}</td>
                  <td className="px-3 py-2">{entry.kind === "endorsement" ? "Endorsement advance" : "Insurance advance"}</td>
                  <td className="px-3 py-2">{entry.regNo}</td>
                  <td className="px-3 py-2">{entry.phone}</td>
                  <td className="px-3 py-2">{entry.description}</td>
                  <td className="px-3 py-2">{formatINR(entry.amount || 0)}</td>
                  <td className="px-3 py-2">
                    <button type="button" className="text-xs text-red-700 underline" onClick={() => deleteAdvance(entry.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
