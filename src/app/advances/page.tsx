"use client";

import { useState } from "react";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { useStore } from "@/lib/store";
import { advanceTypeLabel, formatDDMMYY, formatINR, phoneDigits, phoneError, todayISO, vehicleNumberError } from "@/lib/utils";

export default function AdvancesPage() {
  const { data, ready, addAdvance, deleteAdvance } = useStore();
  const advanceTypes = data.masters.advanceTypes?.length
    ? data.masters.advanceTypes
    : [{ id: "adv_insurance", label: "Insurance advance" }];
  const [kind, setKind] = useState(advanceTypes[0]?.label || "Insurance advance");
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
        subtitle="Choose an advance type from Admin. The amount received is added to that day's opening balance and the report."
      />
      <Panel className="mb-6">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const vehicleProblem = vehicleNumberError(regNo);
            const phoneProblem = phoneError(phone);
            if (vehicleProblem || phoneProblem || !description.trim()) {
              setNote(vehicleProblem || phoneProblem || "Enter a description.");
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
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {advanceTypes.map((item) => (
                <option key={item.id} value={item.label}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Vehicle number *">
            <Input value={regNo} onChange={(e) => setRegNo(e.target.value.toUpperCase())} placeholder="KA01AB1234" />
            {regNo.trim() && vehicleNumberError(regNo) ? (
              <p className="mt-1 text-xs text-red-700">{vehicleNumberError(regNo)}</p>
            ) : null}
          </Field>
          <Field label="Phone *">
            <Input
              inputMode="numeric"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(phoneDigits(e.target.value))}
              placeholder="10 digits"
            />
            {phone && phoneError(phone) ? <p className="mt-1 text-xs text-red-700">{phoneError(phone)}</p> : null}
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
                  <td className="px-3 py-2">{advanceTypeLabel(entry.kind)}</td>
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
