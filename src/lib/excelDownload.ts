import {
  customerCredit,
  expenseCategory,
  expenseSignedAmount,
  type AppData,
  type Expense,
  type Policy,
} from "./types";
import { cashPosition, isFullMonth, portalPoRows, REPORT_HEADERS, sheetCells, sheetRows } from "./ledger";
import { isOfflineDesktop } from "./persist";
import { inDateRange } from "./utils";

type Cell = string | number;
type Sheet = { name: string; rows: Cell[][] };

function escXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(value: Cell): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escXml(String(value ?? ""))}</Data></Cell>`;
}

export function excelXml(sheets: Sheet[]): string {
  const body = sheets
    .map((sheet) => {
      const name = escXml((sheet.name || "Sheet").slice(0, 31) || "Sheet");
      const rows = sheet.rows
        .map((row) => `<Row>${row.map(cellXml).join("")}</Row>`)
        .join("");
      return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
    })
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${body}
</Workbook>`;
}

function browserDownload(fileName: string, xml: string) {
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadExcelFile(opts: {
  sheets: Sheet[];
  kind: string;
  date?: string;
  silent?: boolean;
}): Promise<{ path?: string; fileName?: string } | null> {
  const xml = excelXml(opts.sheets);
  const date =
    (opts.date || new Date().toISOString().slice(0, 10)).slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const kind = (opts.kind || "report").replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
  const fileName = `${date}_${kind}.xls`;

  if (isOfflineDesktop() && window.shopdesk?.saveExcelReport) {
    try {
      const result = await window.shopdesk.saveExcelReport({
        content: xml,
        kind,
        date,
        extension: "xls",
        silent: opts.silent,
      });
      if (!opts.silent) alert(`Excel downloaded:\n${result.path}`);
      return result;
    } catch (err) {
      console.error(err);
      if (!opts.silent) {
        alert(
          `Could not save Excel on this PC.\n${err instanceof Error ? err.message : String(err)}\nDownloading in the browser instead.`,
        );
      } else {
        return null;
      }
    }
  }

  if (opts.silent) return null;
  browserDownload(fileName, xml);
  return { fileName };
}

function expenseRows(expenses: Expense[]): Cell[][] {
  return [
    ["Date", "Sign", "Amount", "Description", "Net vs profit"],
    ...expenses.map((e) => [
      e.date,
      e.sign || "-",
      e.amount || 0,
      e.description || "",
      expenseSignedAmount(e),
    ]),
  ];
}

export async function downloadMonthlyExcel(opts: {
  monthLabel: string;
  from: string;
  to: string;
  data: AppData;
  date?: string;
  silent?: boolean;
}): Promise<{ path?: string; fileName?: string } | null> {
  const { monthLabel, from, to, data } = opts;
  const policies = data.policies.filter((policy) => inDateRange(policy.date, from, to));
  const expenses = (data.expenses || []).filter((expense) => inDateRange(expense.date, from, to));
  const receipts = (data.portalReceipts || []).filter((receipt) => inDateRange(receipt.date, from, to));
  const pucEntries = (data.pucEntries || []).filter((entry) => inDateRange(entry.date, from, to));
  const cash = cashPosition(data, from, to);
  const portals = portalPoRows(data, to);
  const house = expenses.filter((expense) => expenseCategory(expense) === "house");
  const office = expenses.filter((expense) => expenseCategory(expense) === "office");
  const rows = sheetRows({
    policies,
    expenses,
    receipts,
    opening: cash.opening,
    closing: cash.closing,
  });
  const totals = rows.reduce(
    (sum, row) => ({
      received: sum.received + row.received,
      paid: sum.paid + row.paidToCompany,
      payout: sum.payout + row.payout,
      tds: sum.tds + row.tds,
      discount: sum.discount + row.discount,
      house: sum.house + row.house,
      shop: sum.shop + row.shop,
      insExtra: sum.insExtra + row.insExtra,
      totalProfit: sum.totalProfit + row.totalProfit,
      balance: sum.balance + row.balance,
      poReceived: sum.poReceived + row.poReceived,
      estimated: sum.estimated + row.estimatedProfit,
    }),
    {
      received: 0,
      paid: 0,
      payout: 0,
      tds: 0,
      discount: 0,
      house: 0,
      shop: 0,
      insExtra: 0,
      totalProfit: 0,
      balance: 0,
      poReceived: 0,
      estimated: 0,
    },
  );
  const totalRow: (string | number)[] = REPORT_HEADERS.map(() => "");
  totalRow[1] = "TOTAL";
  totalRow[2] = totals.received;
  totalRow[3] = totals.paid;
  totalRow[4] = totals.payout;
  totalRow[5] = totals.tds;
  totalRow[6] = totals.discount;
  totalRow[7] = totals.house;
  totalRow[8] = totals.shop;
  totalRow[9] = totals.insExtra;
  totalRow[10] = totals.totalProfit;
  totalRow[11] = totals.balance;
  totalRow[13] = totals.poReceived;
  totalRow[14] = cash.closing;
  totalRow[25] = totals.estimated;

  const closingLabel = isFullMonth(from, to)
    ? `Closing balance for ${monthLabel}`
    : `Closing balance ${from} to ${to}`;

  return downloadExcelFile({
    kind: "monthly-report",
    date: opts.date || to || from,
    silent: opts.silent,
    sheets: [
      {
        name: "Report",
        rows: [
          ["ShopDesk report", monthLabel],
          [`${from} to ${to}`],
          [],
          ["Opening balance", cash.opening],
          ["Estimated profit (portal)", cash.estimatedProfit],
          ["Ins Extra PO", cash.insExtra],
          ["Total profit (incl. Ins Extra PO)", cash.totalProfit],
          ["Company / portal payment", cash.companyPay],
          ["House expense", cash.house],
          ["Shop / office expense", cash.office],
          [closingLabel, cash.closing],
          ["PUC certificate income (not in closing)", cash.pucIncome],
          [],
          [...REPORT_HEADERS],
          ...rows.map(sheetCells),
          totalRow,
        ],
      },
      {
        name: "Portal PO",
        rows: [
          ["Portal PO as of", to],
          ["Estimated profit is the money from the portal. Ins Extra PO is not included."],
          [],
          ["Portal / company", "Kind", "Companies", "To come", "Received", "Pending"],
          ...portals.map((row) => [
            row.name,
            row.kind,
            row.companies.join(", "),
            row.toCome,
            row.received,
            row.pending,
          ]),
          [],
          ["PO received in this report"],
          ["Date", "Portal", "Amount", "Notes"],
          ...receipts.map((receipt) => [
            receipt.date,
            receipt.portal,
            receipt.amount || 0,
            receipt.notes || "",
          ]),
        ],
      },
      {
        name: "PUC certificates",
        rows: [
          ["Date", "Client", "Vehicle", "Mode", "Amount", "Notes"],
          ...pucEntries.map((entry) => [
            entry.date,
            entry.clientName || "",
            entry.regNo || "",
            entry.vehicleMode || "",
            entry.amount || 0,
            entry.notes || "",
          ]),
        ],
      },
      { name: "House expenses", rows: expenseRows(house) },
      { name: "Office expenses", rows: expenseRows(office) },
    ],
  });
}

export async function downloadClientSheetExcel(opts: {
  title: string;
  policies: Policy[];
  date?: string;
}): Promise<void> {
  await downloadExcelFile({
    kind: "renewal-sheet",
    date: opts.date,
    sheets: [
      {
        name: "Clients",
        rows: [
          [opts.title],
          [
            "REG NO",
            "MODEL",
            "VARIANT",
            "PORTAL",
            "Company",
            "Payments",
            "Receipts",
            "Credit",
            "Ins Owner",
            "CONTACT N",
            "Description",
            "RENEWAL",
          ],
          ...opts.policies.map((p) => [
            p.regNo || "",
            p.vehicleMode || "",
            p.variant || "",
            p.portal || "",
            p.company || "",
            p.payment || 0,
            p.received || 0,
            customerCredit(p),
            p.clientName || "",
            p.phone || p.contact || "",
            p.description || "",
            p.expiryDate || "",
          ]),
        ],
      },
    ],
  });
}
