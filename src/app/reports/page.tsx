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
import { DecimalInput } from "@/components/DecimalInput";
import { useStore } from "@/lib/store";
import { downloadMonthlyPdf } from "@/lib/monthlyPdf";
import { downloadMonthlyExcel } from "@/lib/excelDownload";
import { cashPosition, isFullMonth, portalPoRows, REPORT_HEADERS, sheetCells, sheetRows, sheetTotals, tdsByPortal } from "@/lib/ledger";
import { customerCredit, expenseCategory, isCreditPayment, roundMoney, type ExpenseCategory } from "@/lib/types";
import { advanceTypeLabel, dateKey, formatDDMMYY, formatINR, inDateRange, monthRange, todayISO } from "@/lib/utils";
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
  const { data, ready, addExpense, deleteExpense, setCashOpening, addOpeningEntry, deleteOpeningEntry } = useStore();
  const [openingKind, setOpeningKind] = useState<"investment" | "payout">("investment");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [openingDate, setOpeningDate] = useState<string | null>(null);
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
  const openingDay = openingDate || from;

  function applyPreset(next: DateRangePreset) {
    setPreset(next);
    if (next === "all") {
      setCustomFrom(null);
      setCustomTo(null);
      return;
    }
    if (next === "today") {
      setCustomFrom(today);
      setCustomTo(today);
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
    () =>
      expenses.filter((e) => {
        const category = expenseCategory(e);
        return category === "office" || category === "puc";
      }),
    [expenses],
  );
  const openingDayCash = useMemo(() => cashPosition(data, openingDay, openingDay), [data, openingDay]);
  const openingExtras = useMemo(
    () =>
      roundMoney(
        (data.openingEntries || [])
          .filter((entry) => dateKey(entry.date) === openingDay)
          .reduce((sum, entry) => sum + (entry.amount || 0), 0) +
          (data.advances || [])
            .filter((entry) => dateKey(entry.date) === openingDay)
            .reduce((sum, entry) => sum + (entry.amount || 0), 0),
      ),
    [data.openingEntries, data.advances, openingDay],
  );

  const outsideRange = useMemo(() => {
    return data.policies.filter((p) => !inDateRange(p.date, from, to)).length;
  }, [data.policies, from, to]);

  const summary = useMemo(() => {
    const cash = cashPosition(data, from, to);
    const portals = portalPoRows(data, to);
    const rows = sheetRows({
      policies,
      expenses,
      receipts: (data.portalReceipts || []).filter((receipt) => inDateRange(receipt.date, from, to)),
      pucEntries: puc,
      advances: (data.advances || []).filter((entry) => inDateRange(entry.date, from, to)),
      opening: cash.opening,
      closing: cash.closing,
    });
    const credit = policies.reduce((sum, policy) => sum + customerCredit(policy), 0);
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
      cash,
      rows,
      portals,
      companyTds: tdsByPortal(policies),
      totals: sheetTotals(rows),
      credit,
      received: policies.reduce((sum, policy) => sum + (policy.received || 0), 0),
      paymentByMode: [...paymentByMode.entries()]
        .map(([mode, amount]) => ({ mode, amount }))
        .sort((a, b) => {
          if (isCreditPayment(a.mode) !== isCreditPayment(b.mode)) {
            return isCreditPayment(a.mode) ? 1 : -1;
          }
          return b.amount - a.amount;
        }),
    };
  }, [data, policies, expenses, puc, from, to]);

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
    void downloadMonthlyPdf({
      monthLabel: monthLabel(),
      from,
      to,
      data,
    });
  }

  function downloadExcel() {
    void downloadMonthlyExcel({
      monthLabel: monthLabel(),
      from,
      to,
      data,
    });
  }

  async function sendEmail() {
    try {
      const pdf = await downloadMonthlyPdf({
        monthLabel: monthLabel(),
        from,
        to,
        data,
        date: to || from,
        silent: true,
      });
      const excel = await downloadMonthlyExcel({
        monthLabel: monthLabel(),
        from,
        to,
        data,
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
        subtitle="Opening includes investments, payouts and advances received. PUC expenses are deducted from the closing balance. Estimated profit is company profit minus TDS and discount."
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
        <Stat label="Opening balance" value={formatINR(summary.cash.opening)} hint={summary.cash.openingIsSet ? `Set for ${from}` : "Carried from the previous closing"} />
        <Stat label="Estimated profit (portal)" value={formatINR(summary.cash.estimatedProfit)} hint="Does not include Ins Extra PO" />
        <Stat label="Ins Extra PO" value={formatINR(summary.cash.insExtra)} />
        <Stat label="Insurance profit" value={formatINR(summary.cash.insuranceProfit)} hint="Estimated profit + Ins Extra PO" />
        <Stat label="PUC profit" value={formatINR(summary.cash.pucIncome)} hint="Added into total profit and the balance" />
        <Stat label="PUC expenses" value={formatINR(summary.cash.pucExpense)} hint="Deducted from the closing balance" />
        <Stat label="Advances received" value={formatINR(summary.cash.advances)} hint="Added to that day's opening balance" />
        <Stat label="Total profit" value={formatINR(summary.cash.totalProfit)} hint="Insurance profit + PUC profit" />
        <Stat label="Total TDS paid" value={formatINR(summary.cash.tds)} hint="Same total as the Excel download" />
        <Stat label="Company / portal payment" value={formatINR(summary.cash.companyPay)} hint="Deducted from the balance" />
        <Stat
          label="House expenses"
          value={formatINR(summary.cash.house)}
          hint="Tap to see details"
          onClick={() => setShowExpenses((v) => !v)}
        />
        <Stat
          label="Shop / office expenses"
          value={formatINR(summary.cash.office)}
          hint="Tap to see details"
          onClick={() => setShowExpenses((v) => !v)}
        />
        <Stat
          label={isFullMonth(from, to) ? `Closing balance · ${monthLabel()}` : "Closing balance"}
          value={formatINR(summary.cash.closing)}
          hint="Updates as soon as entries change"
        />
        <Stat label="Received from party" value={formatINR(summary.received)} />
        <Stat
          label="Balance amount"
          value={formatINR(summary.credit)}
          hint="Still unpaid by the customer"
          valueClassName={summary.credit > 0 ? "text-red-700" : "text-slate-900"}
          className={summary.credit > 0 ? "border-red-200 bg-red-50" : ""}
        />
        <Stat label="Insurance entries" value={String(summary.count)} />
      </div>

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Opening balance</h2>
        <p className="mb-3 text-sm text-slate-600">
          Pick the opening date here. Investments, payouts and advances received on that date are added to the amount. Tomorrow carries the closing unless you set a new opening.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Opening date">
            <Input
              type="date"
              value={openingDay}
              onChange={(e) => {
                if (e.target.value) setOpeningDate(e.target.value);
              }}
            />
          </Field>
          <Field label={`Opening amount · ${formatDDMMYY(openingDay) || openingDay}`}>
            <DecimalInput
              value={roundMoney(openingDayCash.opening - openingExtras)}
              maxDecimals={2}
              onValue={(amount) => setCashOpening(openingDay, amount)}
            />
          </Field>
        </div>
        {openingExtras > 0 ? (
          <p className="mt-2 text-sm text-slate-700">
            Opening used {formatINR(openingDayCash.opening)} = {formatINR(roundMoney(openingDayCash.opening - openingExtras))} + {formatINR(openingExtras)} investments, payouts and advances.
          </p>
        ) : null}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-800">Investments and regular payouts</p>
          <p className="mb-3 text-xs text-slate-600">
            Each amount is added to the opening balance for {formatDDMMYY(openingDay) || openingDay}. Advances received on this date are added too.
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label="Type">
              <Select value={openingKind} onChange={(e) => setOpeningKind(e.target.value as "investment" | "payout")}>
                <option value="investment">Investment</option>
                <option value="payout">Payout received</option>
              </Select>
            </Field>
            <Field label="Amount">
              <Input
                inputMode="decimal"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
              />
            </Field>
            <Field label="Description">
              <Input
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value.toUpperCase())}
                placeholder="MONTHLY INVESTMENT"
              />
            </Field>
            <Button
              type="button"
              onClick={() => {
                const amount = Number(openingAmount) || 0;
                if (amount <= 0) return;
                addOpeningEntry({
                  date: openingDay,
                  kind: openingKind,
                  amount,
                  description: openingNote,
                });
                setOpeningAmount("");
                setOpeningNote("");
              }}
            >
              Add to opening
            </Button>
          </div>
          {(data.openingEntries || []).filter((entry) => dateKey(entry.date) === openingDay).length ||
          (data.advances || []).filter((entry) => dateKey(entry.date) === openingDay).length ? (
            <ul className="space-y-1 text-sm">
              {(data.advances || [])
                .filter((entry) => dateKey(entry.date) === openingDay)
                .map((entry) => (
                  <li key={entry.id}>
                    Advance · {advanceTypeLabel(entry.kind)} · {formatINR(entry.amount)}
                    {entry.regNo ? ` · ${entry.regNo}` : ""}
                  </li>
                ))}
              {(data.openingEntries || [])
                .filter((entry) => dateKey(entry.date) === openingDay)
                .map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2">
                    <span>
                      {entry.kind === "investment" ? "Investment" : "Payout"} · {formatINR(entry.amount)}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </span>
                    <button type="button" className="text-xs text-red-700 underline" onClick={() => deleteOpeningEntry(entry.id)}>
                      Delete
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No extra investments or payouts on this date.</p>
          )}
        </div>
      </Panel>

      {summary.count === 0 ? (
        <Panel className="mb-6 text-sm text-slate-600">
          No insurance in this date range. Adjust From / To, or click “Show all
          dates”.
        </Panel>
      ) : null}

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold">TDS paid by portal</h2>
        <p className="mb-3 text-sm text-slate-600">
          TDS taken from company profit, grouped by portal. Total TDS paid is {formatINR(summary.cash.tds)}.
        </p>
        {summary.companyTds.length === 0 ? (
          <p className="text-sm text-slate-600">No TDS in this date range.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.companyTds.map((row) => (
              <div key={row.company} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.company}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatINR(row.tds)}</p>
                <p className="text-xs text-slate-500">{row.policies} insurance {row.policies === 1 ? "entry" : "entries"}</p>
              </div>
            ))}
            <div className="rounded-md border border-slate-300 bg-white px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total TDS paid</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatINR(summary.cash.tds)}</p>
            </div>
          </div>
        )}
      </Panel>

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

      <h2 className="mb-2 text-base font-semibold text-slate-900">Daily report</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {REPORT_HEADERS.map((header) => (
                <th key={header} className="whitespace-nowrap px-2 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.rows.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-sm text-slate-600" colSpan={REPORT_HEADERS.length}>
                  No rows in this date range.
                </td>
              </tr>
            ) : (
              summary.rows.map((row, index) => (
                <tr key={`${row.issuedDate}-${row.party}-${index}`} className="border-b border-slate-100">
                  {sheetCells(row).map((cell, cellIndex) => {
                    const header = REPORT_HEADERS[cellIndex];
                    const text = typeof cell === "number" ? formatINR(cell) : cell || "—";
                    return (
                      <td key={`${header}-${index}`} className="whitespace-nowrap px-2 py-2">
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {summary.rows.length ? (
              <tr className="bg-slate-50 font-semibold">
                <td className="px-2 py-2" />
                <td className="px-2 py-2">TOTAL</td>
                {sheetCells({
                  ...summary.rows[0],
                  issuedDate: "",
                  party: "",
                  received: summary.totals.received,
                  paidToCompany: summary.totals.paid,
                  payout: summary.totals.payout,
                  tds: summary.totals.tds,
                  discount: summary.totals.discount,
                  house: summary.totals.house,
                  shop: summary.totals.shop,
                  totalProfit: summary.totals.totalProfit,
                  balance: summary.totals.balance,
                  balanceReceived: summary.totals.balanceReceived,
                  poReceived: summary.totals.poReceived,
                  openClose: summary.cash.closing,
                  regNo: "",
                  model: "",
                  variant: "",
                  rcOwner: "",
                  contact: "",
                  portal: "",
                  company: "",
                  expiry: "",
                })
                  .slice(2)
                  .map((cell, cellIndex) => (
                    <td key={`total-${cellIndex}`} className="whitespace-nowrap px-2 py-2">
                      {typeof cell === "number" ? formatINR(cell) : cell || ""}
                    </td>
                  ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mb-6 text-sm text-slate-600">
        The Excel file has three sheets: Summary, then Report, then Portal PO. Portal PO lists earning, TDS, received, and pending. Company names stay on the Report sheet.
      </p>
      <ReportPrintLayout
        from={from}
        to={to}
        cash={summary.cash}
        rows={summary.rows}
        portals={summary.portals}
        pucEntries={puc}
        closingLabel={isFullMonth(from, to) ? `Closing balance for ${monthLabel()}` : "Closing balance"}
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
      description: expDesc.trim().toUpperCase(),
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
              onChange={(e) => setExpDesc(e.target.value.toUpperCase())}
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
