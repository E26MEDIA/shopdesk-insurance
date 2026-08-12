"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  Stat,
  Textarea,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import { downloadMonthlyPdf } from "@/lib/monthlyPdf";
import { policyProfit } from "@/lib/types";
import { formatINR, todayISO } from "@/lib/utils";

export default function ReportsPage() {
  const { data, ready, addExpense, deleteExpense, setTodayPucAmount } =
    useStore();
  const today = todayISO();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [rangeInit, setRangeInit] = useState(false);

  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expDate, setExpDate] = useState(today);
  const [expSign, setExpSign] = useState<"+" | "-">("-");
  const [showExpenses, setShowExpenses] = useState(false);

  const [pucDate, setPucDate] = useState(today);
  const [pucAmount, setPucAmount] = useState("");

  // Include all existing entries in the default range (not only this month)
  useEffect(() => {
    if (!ready || rangeInit) return;
    const dates = [
      ...data.policies.map((p) => p.date),
      ...data.pucEntries.map((p) => p.date),
      ...(data.expenses || []).map((e) => e.date),
    ]
      .filter(Boolean)
      .sort();
    if (dates.length) {
      setFrom(dates[0]);
      const latest = dates[dates.length - 1];
      setTo(latest > today ? latest : today);
    }
    setRangeInit(true);
  }, [ready, data.policies, data.pucEntries, data.expenses, rangeInit, today]);

  const pucForDate = useMemo(() => {
    const daily = data.pucEntries.find(
      (p) => p.date === pucDate && p.notes === "Daily PUC total",
    );
    if (daily) return daily.amount;
    return data.pucEntries
      .filter((p) => p.date === pucDate)
      .reduce((s, p) => s + (p.amount || 0), 0);
  }, [data.pucEntries, pucDate]);

  const policies = useMemo(
    () => data.policies.filter((p) => p.date >= from && p.date <= to),
    [data.policies, from, to],
  );
  const puc = useMemo(
    () => data.pucEntries.filter((p) => p.date >= from && p.date <= to),
    [data.pucEntries, from, to],
  );
  const expenses = useMemo(
    () => (data.expenses || []).filter((e) => e.date >= from && e.date <= to),
    [data.expenses, from, to],
  );

  const outsideRange = useMemo(() => {
    return data.policies.filter((p) => p.date < from || p.date > to).length;
  }, [data.policies, from, to]);

  const summary = useMemo(() => {
    const received = policies.reduce((s, p) => s + (p.received || 0), 0);
    const payout = policies.reduce((s, p) => s + (p.payment || 0), 0);
    const insuranceProfit = policies.reduce((s, p) => s + policyProfit(p), 0);
    const pucIncome = puc.reduce((s, p) => s + (p.amount || 0), 0);
    const expenseNet = expenses.reduce((s, e) => {
      const n = e.amount || 0;
      const sign = e.sign || "-";
      return s + (sign === "+" ? n : -n);
    }, 0);
    const totalProfit = insuranceProfit + pucIncome + expenseNet;

    return {
      count: policies.length,
      received,
      payout,
      insuranceProfit,
      pucIncome,
      expenseTotal: expenseNet,
      totalProfit,
    };
  }, [policies, puc, expenses]);

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  function downloadPdf() {
    const monthLabel =
      from.slice(0, 7) === to.slice(0, 7)
        ? new Date(`${from.slice(0, 7)}-01`).toLocaleString("en-IN", {
            month: "long",
            year: "numeric",
          })
        : `${from} to ${to}`;
    downloadMonthlyPdf({
      monthLabel,
      from,
      to,
      policies,
      pucEntries: puc,
    });
  }

  function sendEmailLater() {
    alert(
      "Send to email will work after email configuration is set up. We’ll add that later.",
    );
  }

  function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(String(expAmount).trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter an expense amount greater than 0.");
      return;
    }
    if (!expDesc.trim()) {
      alert("Enter an expense description (e.g. salary, rent, petrol).");
      return;
    }
    const day = expDate || today;
    addExpense({
      date: day,
      amount,
      sign: expSign,
      description: expDesc.trim(),
    });
    // Keep the expense visible in the current report range
    if (day < from) setFrom(day);
    if (day > to) setTo(day);
    setExpAmount("");
    setExpDesc("");
    setExpSign("-");
    setShowExpenses(true);
    alert("Expense saved.");
  }

  function savePuc(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(pucAmount !== "" ? pucAmount : pucForDate) || 0;
    setTodayPucAmount(amount, "Daily PUC total", pucDate);
    setPucAmount("");
    alert(`PUC amount updated for ${pucDate}.`);
  }

  function showAllDates() {
    const dates = [
      ...data.policies.map((p) => p.date),
      ...data.pucEntries.map((p) => p.date),
      ...(data.expenses || []).map((e) => e.date),
    ]
      .filter(Boolean)
      .sort();
    if (!dates.length) return;
    setFrom(dates[0]);
    const latest = dates[dates.length - 1];
    setTo(latest > today ? latest : today);
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Total profit = insurance + PUC ± expenses"
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={downloadPdf}>
              Download PDF
            </Button>
            <Button type="button" variant="secondary" onClick={sendEmailLater}>
              Send to email
            </Button>
          </div>
        }
      />

      <Panel className="mb-6 grid max-w-xl gap-3 sm:grid-cols-2">
        <Field label="From">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        {outsideRange > 0 ? (
          <p className="sm:col-span-2 text-sm text-amber-800">
            {outsideRange} insurance entr
            {outsideRange === 1 ? "y is" : "ies are"} outside this date range
            (profit not included).{" "}
            <button type="button" className="underline" onClick={showAllDates}>
              Show all dates
            </button>
          </p>
        ) : null}
      </Panel>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Insurance entries" value={String(summary.count)} />
        <Stat label="Received from customer" value={formatINR(summary.received)} />
        <Stat label="We pay company" value={formatINR(summary.payout)} />
        <Stat
          label="Insurance profit"
          value={formatINR(summary.insuranceProfit)}
        />
        <Stat label="PUC (in range)" value={formatINR(summary.pucIncome)} />
        <Stat
          label="Expenses (+/−)"
          value={formatINR(summary.expenseTotal)}
          hint="Tap to see details"
          onClick={() => setShowExpenses((v) => !v)}
        />
        <Stat label="Total profit" value={formatINR(summary.totalProfit)} />
      </div>

      {summary.count === 0 ? (
        <Panel className="mb-6 text-sm text-slate-600">
          No insurance in this date range. Adjust From / To, or click “Show all
          dates”.
        </Panel>
      ) : null}

      {showExpenses ? (
        <Panel className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Expense details</h2>
            <Button
              type="button"
              variant="secondary"
              className="!py-1 text-xs"
              onClick={() => setShowExpenses(false)}
            >
              Close
            </Button>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-600">
              No expenses in this date range.
            </p>
          ) : (
            <ul className="space-y-2">
              {expenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {e.description || "Expense"}
                    </p>
                    <p className="text-slate-600">
                      {e.date} · {e.sign || "-"}
                      {formatINR(e.amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => deleteExpense(e.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <Panel className="mb-6">
        <h2 className="mb-2 text-base font-semibold">PUC amount</h2>
        <p className="mb-3 text-sm text-slate-600">
          Choose the date, enter PUC total, and update. Included in total
          profit.
        </p>
        <form onSubmit={savePuc} className="flex flex-wrap items-end gap-3">
          <Field label="Date">
            <Input
              type="date"
              value={pucDate}
              onChange={(e) => {
                setPucDate(e.target.value);
                setPucAmount("");
              }}
            />
          </Field>
          <Field label="Amount">
            <Input
              inputMode="decimal"
              className="no-spin"
              value={pucAmount}
              onChange={(e) =>
                setPucAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder={String(pucForDate || 0)}
            />
          </Field>
          <Button type="submit">Update PUC</Button>
          <p className="text-sm text-slate-600">
            Current for this date: <strong>{formatINR(pucForDate)}</strong>
          </p>
        </form>
      </Panel>

      <Panel className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Add expense</h2>
        <p className="mb-3 text-sm text-slate-600">
          Choose + or −, amount, and description (e.g. salary expense).
        </p>
        <form
          onSubmit={saveExpense}
          className="grid max-w-xl gap-3 sm:grid-cols-2"
        >
          <Field label="Date">
            <Input
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
            />
          </Field>
          <Field label="Sign">
            <Select
              value={expSign}
              onChange={(e) => setExpSign(e.target.value as "+" | "-")}
            >
              <option value="-">− Minus</option>
              <option value="+">+ Add</option>
            </Select>
          </Field>
          <Field label="Amount">
            <Input
              inputMode="decimal"
              className="no-spin"
              required
              value={expAmount}
              onChange={(e) =>
                setExpAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder="0"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea
                required
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Salary expense, rent, petrol…"
              />
            </Field>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit">Save expense</Button>
          </div>
        </form>
      </Panel>

      <Panel className="text-sm text-slate-600">
        Formula: (insurance profit + PUC) ± expenses ={" "}
        <strong>{formatINR(summary.totalProfit)}</strong>
      </Panel>
    </div>
  );
}
