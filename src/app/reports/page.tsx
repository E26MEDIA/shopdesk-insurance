"use client";

import { useMemo, useState } from "react";
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
import { DateRangeBar, type DateRangePreset } from "@/components/DateRangeBar";
import { DownloadMenu } from "@/components/DownloadMenu";
import { PucEditor } from "@/components/PucEditor";
import { useStore } from "@/lib/store";
import { downloadMonthlyPdf } from "@/lib/monthlyPdf";
import { downloadMonthlyExcel } from "@/lib/excelDownload";
import {
  customerBill,
  customerCredit,
  expenseCategory,
  expenseNet,
  isCreditPayment,
  policyProfit,
  type ExpenseCategory,
} from "@/lib/types";
import { formatINR, inDateRange, monthRange, todayISO } from "@/lib/utils";
import { printPage } from "@/lib/persist";
import { requireOfficeAdminPin } from "@/lib/persist";
import { composeReportEmail, REPORT_EMAIL, reportMailBody, reportMailSubject } from "@/lib/reportEmail";
import { ReportPrintLayout } from "@/components/PrintLayouts";

function spanFromDates(dates: string[], today: string): { from: string; to: string } {
  if (!dates.length) {
    return { from: `${today.slice(0, 8)}01`, to: today };
  }
  const latest = dates[dates.length - 1];
  return { from: dates[0], to: latest > today ? latest : today };
}

export default function ReportsPage() {
  const { data, ready, addExpense, deleteExpense } = useStore();
  const today = todayISO();
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [showExpenses, setShowExpenses] = useState(false);

  const allDates = useMemo(
    () =>
      [
        ...data.policies.map((p) => p.date),
        ...data.pucEntries.map((p) => p.date),
        ...(data.expenses || []).map((e) => e.date),
      ]
        .filter(Boolean)
        .sort(),
    [data.policies, data.pucEntries, data.expenses],
  );
  const dataRange = useMemo(() => spanFromDates(allDates, today), [allDates, today]);
  const from = preset === "all" ? dataRange.from : customFrom || dataRange.from;
  const to = preset === "all" ? dataRange.to : customTo || dataRange.to;

  function applyPreset(next: DateRangePreset) {
    setPreset(next);
    if (next === "all") {
      setCustomFrom(null);
      setCustomTo(null);
      return;
    }
    if (next === "this_month") {
      const range = monthRange(0);
      setCustomFrom(range.from);
      setCustomTo(range.to);
      return;
    }
    if (next === "last_month") {
      const range = monthRange(-1);
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  }

  function changeFrom(value: string) {
    if (!value) return;
    setPreset("custom");
    setCustomFrom(value);
    setCustomTo((prev) => {
      const currentTo = prev || dataRange.to;
      return value > currentTo ? value : currentTo;
    });
  }

  function changeTo(value: string) {
    if (!value) return;
    setPreset("custom");
    setCustomTo(value);
    setCustomFrom((prev) => {
      const currentFrom = prev || dataRange.from;
      return value < currentFrom ? value : currentFrom;
    });
  }

  const policies = useMemo(
    () => data.policies.filter((p) => inDateRange(p.date, from, to)),
    [data.policies, from, to],
  );
  const puc = useMemo(
    () => data.pucEntries.filter((p) => inDateRange(p.date, from, to)),
    [data.pucEntries, from, to],
  );
  const expenses = useMemo(
    () => (data.expenses || []).filter((e) => inDateRange(e.date, from, to)),
    [data.expenses, from, to],
  );
  const houseExpenses = useMemo(
    () => expenses.filter((e) => expenseCategory(e) === "house"),
    [expenses],
  );
  const officeExpenses = useMemo(
    () => expenses.filter((e) => expenseCategory(e) === "office"),
    [expenses],
  );

  const outsideRange = useMemo(() => {
    return data.policies.filter((p) => !inDateRange(p.date, from, to)).length;
  }, [data.policies, from, to]);

  const summary = useMemo(() => {
    const received = policies.reduce((s, p) => s + (p.received || 0), 0);
    const payout = policies.reduce((s, p) => s + (p.payment || 0), 0);
    const customerSide = policies.reduce((s, p) => s + customerBill(p), 0);
    const credit = policies.reduce((s, p) => s + customerCredit(p), 0);
    const insuranceProfit = policies.reduce((s, p) => s + policyProfit(p), 0);
    const pucIncome = puc.reduce((s, p) => s + (p.amount || 0), 0);
    const houseTotal = expenseNet(houseExpenses);
    const officeTotal = expenseNet(officeExpenses);
    const expenseTotal = houseTotal + officeTotal;
    const totalProfit = insuranceProfit + pucIncome + expenseTotal;
    const paymentByMode = new Map<string, number>();
    for (const policy of policies) {
      const parts = (policy.customerPayments || []).filter(
        (part) => part.mode && part.amount > 0 && !isCreditPayment(part.mode),
      );
      const payments = parts.length
        ? parts
        : policy.paymentMode && policy.received
          ? [{ mode: policy.paymentMode, amount: policy.received }]
          : [];
      for (const part of payments) {
        paymentByMode.set(part.mode, (paymentByMode.get(part.mode) || 0) + part.amount);
      }
      const creditAmount = customerCredit(policy);
      if (creditAmount > 0) {
        paymentByMode.set("Credit", (paymentByMode.get("Credit") || 0) + creditAmount);
      }
    }

    return {
      count: policies.length,
      received,
      payout,
      customerSide,
      credit,
      insuranceProfit,
      pucIncome,
      houseTotal,
      officeTotal,
      expenseTotal,
      totalProfit,
      paymentByMode: [...paymentByMode.entries()]
        .map(([mode, amount]) => ({ mode, amount }))
        .sort((a, b) => {
          if (isCreditPayment(a.mode) !== isCreditPayment(b.mode)) {
            return isCreditPayment(a.mode) ? 1 : -1;
          }
          return b.amount - a.amount;
        }),
    };
  }, [policies, puc, houseExpenses, officeExpenses]);

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  function monthLabel() {
    return from.slice(0, 7) === to.slice(0, 7)
      ? new Date(`${from.slice(0, 7)}-01`).toLocaleString("en-IN", {
          month: "long",
          year: "numeric",
        })
      : `${from} to ${to}`;
  }

  function downloadPdf() {
    downloadMonthlyPdf({
      monthLabel: monthLabel(),
      from,
      to,
      policies,
      pucEntries: puc,
      expenses,
    });
  }

  function downloadExcel() {
    void downloadMonthlyExcel({
      monthLabel: monthLabel(),
      from,
      to,
      policies,
      pucEntries: puc,
      expenses,
    });
  }

  async function sendEmail() {
    try {
      const pdf = await downloadMonthlyPdf({
        monthLabel: monthLabel(),
        from,
        to,
        policies,
        pucEntries: puc,
        expenses,
        date: to || from,
        silent: true,
      });
      const excel = await downloadMonthlyExcel({
        monthLabel: monthLabel(),
        from,
        to,
        policies,
        pucEntries: puc,
        expenses,
        date: to || from,
        silent: true,
      });
      const files = [pdf?.path, excel?.path].filter(Boolean) as string[];
      await composeReportEmail({
        subject: reportMailSubject("report", from, to),
        text: reportMailBody({
          kind: "report",
          from,
          to,
          files,
        }),
        files,
      });
      alert(`Report email opened for ${REPORT_EMAIL}. Send it from your mail app.`);
    } catch (err) {
      console.error(err);
      alert(
        `Could not open the report email.\n${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function showAllDates() {
    applyPreset("all");
  }

  return (
    <div className="print-page">
      <PageHeader
        title="Reports"
        subtitle="Total profit = insurance + PUC ± house and office expenses"
        action={
          <div className="flex flex-wrap gap-2">
            <DownloadMenu
              items={[
                { label: "Download PDF", onClick: downloadPdf },
                { label: "Download Excel", onClick: downloadExcel },
              ]}
            />
            <Button type="button" variant="secondary" onClick={() => void printPage()}>
              Print report
            </Button>
            <Button type="button" variant="secondary" onClick={() => void sendEmail()}>
              Send to email
            </Button>
          </div>
        }
      />

      <DateRangeBar
        from={from}
        to={to}
        preset={preset}
        onPreset={applyPreset}
        onFrom={changeFrom}
        onTo={changeTo}
        extra={
          outsideRange > 0 ? (
            <p className="text-sm text-amber-800">
              {outsideRange} insurance entr
              {outsideRange === 1 ? "y is" : "ies are"} outside this date range
              (profit not included).{" "}
              <button type="button" className="underline" onClick={showAllDates}>
                Show all dates
              </button>
            </p>
          ) : null
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Insurance entries" value={String(summary.count)} />
        <Stat label="Customer side payment" value={formatINR(summary.customerSide)} />
        <Stat label="Received from customer" value={formatINR(summary.received)} />
        <Stat
          label="Credit"
          value={formatINR(summary.credit)}
          hint="Unpaid on the customer side"
          valueClassName={summary.credit > 0 ? "text-red-700" : "text-slate-900"}
          className={summary.credit > 0 ? "border-red-200 bg-red-50" : ""}
        />
        <Stat label="We pay company" value={formatINR(summary.payout)} />
        <Stat
          label="Insurance profit"
          value={formatINR(summary.insuranceProfit)}
        />
        <Stat label="PUC (in range)" value={formatINR(summary.pucIncome)} />
        <Stat
          label="House expenses"
          value={formatINR(summary.houseTotal)}
          hint="Tap to see details"
          onClick={() => setShowExpenses((v) => !v)}
        />
        <Stat
          label="Office expenses"
          value={formatINR(summary.officeTotal)}
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

      {summary.paymentByMode.length ? (
        <Panel className="mb-6">
          <h2 className="mb-1 text-base font-semibold">Customer payment collection</h2>
          <p className="mb-3 text-sm text-slate-600">Received from customers, split by payment method for this date range.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.paymentByMode.map((payment) => (
              <div
                key={payment.mode}
                className={`rounded-md border px-3 py-2 ${
                  isCreditPayment(payment.mode)
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className={`text-xs font-medium uppercase tracking-wide ${
                  isCreditPayment(payment.mode) ? "text-red-700" : "text-slate-500"
                }`}>{payment.mode}</p>
                <p className={`mt-1 text-lg font-semibold ${
                  isCreditPayment(payment.mode) ? "text-red-700" : "text-slate-900"
                }`}>{formatINR(payment.amount)}</p>
              </div>
            ))}
          </div>
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
          <div className="grid gap-6 lg:grid-cols-2">
            <ExpenseList
              title="House expenses"
              items={houseExpenses}
              onDelete={deleteExpense}
            />
            <ExpenseList
              title="Office expenses"
              items={officeExpenses}
              onDelete={deleteExpense}
            />
          </div>
        </Panel>
      ) : null}

      <div className="mb-6">
        <PucEditor from={from} to={to} compact />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ExpenseForm
          category="house"
          title="House expense"
          hint="Home / personal costs (rent at house, groceries, family, etc.)."
          placeholder="House rent, groceries…"
          onSave={(input) => {
            addExpense(input);
            setShowExpenses(true);
          }}
        />
        <ExpenseForm
          category="office"
          title="Office expense"
          hint="Shop costs (salary, petrol, tea, office rent, etc.)."
          placeholder="Salary expense, rent, petrol…"
          onSave={(input) => {
            addExpense(input);
            setShowExpenses(true);
          }}
        />
      </div>

      <Panel className="text-sm text-slate-600">
        Formula: (insurance profit + PUC) ± house expenses ± office expenses ={" "}
        <strong>{formatINR(summary.totalProfit)}</strong>
      </Panel>
      <ReportPrintLayout
        from={from}
        to={to}
        policies={policies}
        pucEntries={puc}
        received={summary.received}
        payout={summary.payout}
        credit={summary.credit}
        insuranceProfit={summary.insuranceProfit}
        pucIncome={summary.pucIncome}
        houseExpenseTotal={summary.houseTotal}
        officeExpenseTotal={summary.officeTotal}
        expenseTotal={summary.expenseTotal}
        totalProfit={summary.totalProfit}
        houseExpenses={houseExpenses}
        officeExpenses={officeExpenses}
      />
    </div>
  );
}

function ExpenseList({
  title,
  items,
  onDelete,
}: {
  title: string;
  items: { id: string; date: string; amount: number; sign?: "+" | "-"; description: string }[];
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">No expenses in this date range.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
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
                onClick={() =>
                  void (async () => {
                    if (await requireOfficeAdminPin("delete an expense")) onDelete(e.id);
                  })()
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpenseForm({
  category,
  title,
  hint,
  placeholder,
  onSave,
}: {
  category: ExpenseCategory;
  title: string;
  hint: string;
  placeholder: string;
  onSave: (input: {
    date: string;
    amount: number;
    sign: "+" | "-";
    description: string;
    category: ExpenseCategory;
  }) => void;
}) {
  const today = todayISO();
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expDate, setExpDate] = useState(today);
  const [expSign, setExpSign] = useState<"+" | "-">("-");

  function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(expAmount) || 0;
    if (!amount || !expDesc.trim()) return;
    onSave({
      date: expDate,
      amount,
      sign: expSign,
      description: expDesc.trim(),
      category,
    });
    setExpAmount("");
    setExpDesc("");
    setExpSign("-");
  }

  return (
    <Panel>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-slate-600">{hint}</p>
      <form onSubmit={saveExpense} className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input
            type="date"
            value={expDate}
            onChange={(e) => {
              if (e.target.value) setExpDate(e.target.value);
            }}
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
            onChange={(e) => setExpAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea
              required
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder={placeholder}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Save {title.toLowerCase()}</Button>
        </div>
      </form>
    </Panel>
  );
}
