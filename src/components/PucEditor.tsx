"use client";

import { useMemo, useState } from "react";
import { Button, Field, Input, Panel } from "@/components/ui";
import { useStore } from "@/lib/store";
import { dateKey, formatINR, inDateRange, todayISO } from "@/lib/utils";
import { requireOfficeAdminPin } from "@/lib/persist";

export function PucEditor({
  from,
  to,
  compact = false,
}: {
  from?: string;
  to?: string;
  compact?: boolean;
}) {
  const { data, setTodayPucAmount, updatePuc, deletePuc } = useStore();
  const today = todayISO();
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pucAmount, setPucAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const rangeDate =
    from && to
      ? inDateRange(today, from, to)
        ? today
        : dateKey(to) || today
      : today;
  const pucDate =
    pickedDate && (!from || !to || inDateRange(pickedDate, from, to))
      ? pickedDate
      : rangeDate;

  const pucForDate = useMemo(() => {
    const day = dateKey(pucDate);
    const daily = data.pucEntries.find(
      (p) => dateKey(p.date) === day && p.notes === "Daily PUC total",
    );
    if (daily) return daily;
    const dayEntries = data.pucEntries.filter((p) => dateKey(p.date) === day);
    if (!dayEntries.length) return null;
    const amount = dayEntries.reduce((s, p) => s + (p.amount || 0), 0);
    return { ...dayEntries[0], amount, notes: dayEntries[0].notes || "Daily PUC total" };
  }, [data.pucEntries, pucDate]);

  const rows = useMemo(() => {
    return data.pucEntries
      .filter((p) => inDateRange(p.date, from, to))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data.pucEntries, from, to]);

  function startEdit(id: string, date: string, amount: number) {
    setEditingId(id);
    setPickedDate(dateKey(date) || date);
    setPucAmount(amount ? String(amount) : "");
    setStatus("");
  }

  function savePuc(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    if (saving) return;
    const day = dateKey(pucDate) || todayISO();
    if (!day) {
      setStatus("Choose a date first.");
      return;
    }
    if (pucAmount === "" && pucForDate == null) {
      setStatus("Enter the PUC amount.");
      return;
    }
    const amount = Number(pucAmount !== "" ? pucAmount : pucForDate?.amount || 0) || 0;
    setSaving(true);
    try {
      const existing = editingId
        ? data.pucEntries.find((p) => p.id === editingId)
        : null;
      if (existing && existing.notes !== "Daily PUC total") {
        updatePuc(existing.id, { date: day, amount });
      } else {
        setTodayPucAmount(amount, "Daily PUC total", day);
      }
      setPucAmount("");
      setEditingId(null);
      setPickedDate(day);
      setStatus(`PUC amount saved for ${day}.`);
    } catch (err) {
      console.error(err);
      setStatus("Could not save PUC. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className={compact ? "" : "mb-6"}>
      <h2 className="mb-2 text-base font-semibold">Edit PUC amount</h2>
      <p className="mb-3 text-sm text-slate-600">
        PUC is an edit option: choose the date, enter the total, and update. The
        same date overwrites the saved amount instead of adding another row.
      </p>
      <form onSubmit={savePuc} className="flex flex-wrap items-end gap-3">
        <Field label="Date">
          <Input
            type="date"
            value={pucDate}
            onChange={(e) => {
              if (!e.target.value) return;
              setPickedDate(e.target.value);
              setPucAmount("");
              setEditingId(null);
              setStatus("");
            }}
            onInput={(e) => {
              const value = (e.target as HTMLInputElement).value;
              if (!value) return;
              setPickedDate(value);
            }}
          />
        </Field>
        <Field label="Amount">
          <Input
            inputMode="decimal"
            className="no-spin"
            value={pucAmount}
            onChange={(e) => setPucAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={String(pucForDate?.amount || 0)}
          />
        </Field>
        <Button type="button" disabled={saving} onClick={savePuc}>
          {saving ? "Saving…" : "Update PUC"}
        </Button>
        {editingId ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingId(null);
              setPucAmount("");
              setStatus("");
            }}
          >
            Cancel edit
          </Button>
        ) : null}
        <p className="text-sm text-slate-600">
          Current for this date:{" "}
          <strong>{formatINR(pucForDate?.amount || 0)}</strong>
        </p>
      </form>
      {status ? <p className="mt-2 text-sm text-[#0f3d3e]">{status}</p> : null}

      {rows.length ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{dateKey(p.date) || p.date}</td>
                  <td className="px-3 py-2">{formatINR(p.amount)}</td>
                  <td className="px-3 py-2">{p.notes || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-[#0f3d3e] underline"
                        onClick={() => startEdit(p.id, p.date, p.amount)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() =>
                          void (async () => {
                            if (await requireOfficeAdminPin("delete a PUC entry")) {
                              deletePuc(p.id);
                              if (editingId === p.id) {
                                setEditingId(null);
                                setPucAmount("");
                              }
                            }
                          })()
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">No PUC amounts saved yet.</p>
      )}
    </Panel>
  );
}
