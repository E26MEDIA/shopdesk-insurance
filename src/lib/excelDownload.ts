import {
  customerCredit,
  expenseCategory,
  expenseSignedAmount,
  type AppData,
  type Expense,
  type Policy,
} from "./types";
import { cashPosition, portalPoRows, portalProducts, REPORT_HEADERS, sheetCells, sheetRows, sheetTotals, tdsByCompany } from "./ledger";
import { isOfflineDesktop } from "./persist";
import { inDateRange } from "./utils";
import { sheetsToXlsx } from "./xlsx";

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

function browserDownload(fileName: string, bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function downloadExcelFile(opts: {
  sheets: Sheet[];
  kind: string;
  date?: string;
  silent?: boolean;
}): Promise<{ path?: string; fileName?: string } | null> {
  const bytes = sheetsToXlsx(opts.sheets);
  const date =
    (opts.date || new Date().toISOString().slice(0, 10)).slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const kind = (opts.kind || "report").replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
  const fileName = `${date}_${kind}.xlsx`;

  if (isOfflineDesktop() && window.shopdesk?.saveExcelReport) {
    try {
      const result = await window.shopdesk.saveExcelReport({
        content: bytesToBase64(bytes),
        kind,
        date,
        extension: "xlsx",
        encoding: "base64",
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
  browserDownload(fileName, bytes);
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

/** One worksheet: daily register plus company-offer portal earning. */
export function monthlyReportSheet(opts: {
  monthLabel: string;
  from: string;
  to: string;
  data: AppData;
}): Sheet {
  const { from, to, data } = opts;
  const policies = data.policies.filter((policy) => inDateRange(policy.date, from, to));
  const expenses = (data.expenses || []).filter((expense) => inDateRange(expense.date, from, to));
  const receipts = (data.portalReceipts || []).filter((receipt) => inDateRange(receipt.date, from, to));
  const pucEntries = (data.pucEntries || []).filter((entry) => inDateRange(entry.date, from, to));
  const cash = cashPosition(data, from, to);
  const portals = portalPoRows(data, to);
  const products = portalProducts(data, to);
  const house = expenses.filter((expense) => expenseCategory(expense) === "house");
  const office = expenses.filter((expense) => expenseCategory(expense) === "office");
  const rows = sheetRows({
    policies,
    expenses,
    receipts,
    pucEntries,
    opening: cash.opening,
    closing: cash.closing,
  });
  const totals = sheetTotals(rows);
  const companyTds = tdsByCompany(policies);
  const totalRow: (string | number)[] = REPORT_HEADERS.map(() => "");
  totalRow[1] = "TOTAL";
  totalRow[2] = totals.received;
  totalRow[3] = totals.paid;
  totalRow[4] = totals.payout;
  totalRow[5] = totals.tds;
  totalRow[6] = totals.discount;
  totalRow[7] = totals.house;
  totalRow[8] = totals.shop;
  totalRow[9] = totals.totalProfit;
  totalRow[10] = totals.balance;
  totalRow[11] = totals.balanceReceived;
  totalRow[12] = totals.poReceived;
  totalRow[13] = cash.closing;

  return {
    name: "Report",
    rows: [
      [...REPORT_HEADERS],
      ...rows.map(sheetCells),
      totalRow,
      [],
      ["Report summary — same figures as the report screen"],
      ["Opening balance", cash.opening],
      ["Estimated profit (portal)", cash.estimatedProfit],
      ["Ins Extra PO", cash.insExtra],
      ["Insurance profit", cash.insuranceProfit],
      ["PUC profit", cash.pucIncome],
      ["Total profit", cash.totalProfit],
      ["Total TDS paid", cash.tds],
      ["Company / portal payment", cash.companyPay],
      ["House expenses", cash.house],
      ["Shop / office expenses", cash.office],
      ["Closing balance", cash.closing],
      [],
      ["TDS paid by company"],
      ["Company", "Policies", "TDS paid"],
      ...companyTds.map((row) => [row.company, row.policies, row.tds]),
      ["Total TDS paid", policies.length, cash.tds],
      [],
      ["Portal PO"],
      ["Total earning is estimated portal profit (payout − TDS − discount), including direct points. Ins Extra PO is not included. Total profit on the report is insurance profit + PUC profit."],
      [],
      ["Portal", "Insurance count", "Total earning", "TDS paid", "Received", "Pending", "Companies"],
      ...portals.map((row) => [
        row.name,
        row.policies,
        row.toCome,
        row.tds,
        row.received,
        row.pending,
        row.companies.join(", "),
      ]),
      [],
      ["Product amount detail"],
      [
        "Portal",
        "Date",
        "Party",
        "REG NO",
        "Company",
        "Net premium",
        "Company offer %",
        "PAYOUT",
        "TDS",
        "DISCOUNT",
        "Estimated earning",
        "Ins Extra PO",
        "Total profit",
        "Confirmed",
      ],
      ...products.map((product) => [
        product.portal,
        product.date,
        product.party,
        product.regNo,
        product.company,
        product.netPremium,
        product.offerPercent,
        product.payout,
        product.tds,
        product.discount,
        product.estimated,
        product.insExtra,
        product.totalProfit,
        product.confirmed ? "Yes" : "No",
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
      [],
      ["PUC certificates"],
      ["Date", "Client", "Vehicle", "Mode", "Amount", "Notes"],
      ...pucEntries.map((entry) => [
        entry.date,
        entry.clientName || "",
        entry.regNo || "",
        entry.vehicleMode || "",
        entry.amount || 0,
        entry.notes || "",
      ]),
      [],
      ["House expenses"],
      ...expenseRows(house),
      [],
      ["Office expenses"],
      ...expenseRows(office),
    ],
  };
}

export async function downloadMonthlyExcel(opts: {
  monthLabel: string;
  from: string;
  to: string;
  data: AppData;
  date?: string;
  silent?: boolean;
}): Promise<{ path?: string; fileName?: string } | null> {
  return downloadExcelFile({
    kind: "monthly-report",
    date: opts.date || opts.to || opts.from,
    silent: opts.silent,
    sheets: [monthlyReportSheet(opts)],
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
