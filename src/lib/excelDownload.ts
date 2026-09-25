import {
  customerCredit,
  type AppData,
  type Policy,
} from "./types";
import { cashPosition, portalPoRows, REPORT_HEADERS, sheetCells, sheetRows, sheetTotals } from "./ledger";
import { isOfflineDesktop } from "./persist";
import { inDateRange } from "./utils";
import { sheetsToXlsx, type XlsxCell, type XlsxSheet } from "./xlsx";

type Cell = string | number;
type Sheet = { name: string; rows: Cell[][] };

const TITLE = 1;
const NOTE = 2;
const HEAD = 3;
const TEXT = 4;
const MONEY = 5;
const ALT_TEXT = 6;
const ALT_MONEY = 7;
const TOTAL_TEXT = 8;
const TOTAL_MONEY = 9;
const LABEL = 10;
const LABEL_MONEY = 11;
const CLOSE_TEXT = 12;
const CLOSE_MONEY = 13;

function styled(value: string | number, style: number): XlsxCell {
  return { value, style };
}

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
  sheets: XlsxSheet[];
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

/** Three worksheets: summary, the daily report, then portal PO without company names. */
export function monthlyReportSheets(opts: {
  monthLabel: string;
  from: string;
  to: string;
  data: AppData;
}): XlsxSheet[] {
  const { from, to, data } = opts;
  const policies = data.policies.filter((policy) => inDateRange(policy.date, from, to));
  const expenses = (data.expenses || []).filter((expense) => inDateRange(expense.date, from, to));
  const receipts = (data.portalReceipts || []).filter((receipt) => inDateRange(receipt.date, from, to));
  const pucEntries = (data.pucEntries || []).filter((entry) => inDateRange(entry.date, from, to));
  const cash = cashPosition(data, from, to);
  const portals = portalPoRows(data, to).filter(
    (row) => row.policies || row.toCome || row.tds || row.received || row.pending,
  );
  const rows = sheetRows({
    policies,
    expenses,
    receipts,
    pucEntries,
    opening: cash.opening,
    closing: cash.closing,
  });
  const totals = sheetTotals(rows);
  const period = `${opts.monthLabel} · ${from} to ${to}`;
  const summaryLines: [string, number, boolean?][] = [
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
    ["Closing balance", cash.closing, true],
  ];
  const summary: XlsxSheet = {
    name: "Summary",
    tabColor: "0F3D3E",
    widths: [36, 20],
    merges: ["A1:B1"],
    rows: [
      [styled("Insurance Desk — Summary", TITLE), styled("", TITLE)],
      [styled(period, NOTE), ""],
      [],
      [styled("Particular", HEAD), styled("Amount", HEAD)],
      ...summaryLines.map(([label, amount, closing]) => [
        styled(label, closing ? CLOSE_TEXT : LABEL),
        styled(amount, closing ? CLOSE_MONEY : LABEL_MONEY),
      ]),
    ],
  };

  const moneyColumns = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const reportRows: XlsxCell[][] = rows.map((row, index) => {
    const alt = index % 2 === 1;
    return sheetCells(row).map((cell, col) => {
      const money = moneyColumns.has(col) && typeof cell === "number";
      return styled(cell === "" ? "" : cell, money ? (alt ? ALT_MONEY : MONEY) : alt ? ALT_TEXT : TEXT);
    });
  });
  const totalCells = REPORT_HEADERS.map(() => "");
  totalCells[1] = "TOTAL";
  const totalNumbers: Record<number, number> = {
    2: totals.received,
    3: totals.paid,
    4: totals.payout,
    5: totals.tds,
    6: totals.discount,
    7: totals.house,
    8: totals.shop,
    9: totals.totalProfit,
    10: totals.balance,
    11: totals.balanceReceived,
    12: totals.poReceived,
    13: cash.closing,
  };
  const report: XlsxSheet = {
    name: "Report",
    tabColor: "1F4E79",
    freezeRows: 4,
    merges: ["A1:V1"],
    widths: [14, 22, 18, 16, 14, 12, 14, 14, 14, 16, 16, 16, 18, 16, 16, 14, 14, 16, 16, 18, 18, 14],
    rows: [
      [styled("Insurance Desk — Report", TITLE), ...REPORT_HEADERS.slice(1).map(() => styled("", TITLE))],
      [styled(period, NOTE)],
      [],
      REPORT_HEADERS.map((header) => styled(header, HEAD)),
      ...reportRows,
      totalCells.map((cell, index) =>
        styled(index in totalNumbers ? totalNumbers[index] : cell, index in totalNumbers ? TOTAL_MONEY : TOTAL_TEXT),
      ),
    ],
  };

  const portalHeader = ["Portal", "Insurance count", "Total earning", "TDS paid", "Received", "Pending"];
  const portalBody = portals.map((row, index) => {
    const alt = index % 2 === 1;
    return [
      styled(row.name, alt ? ALT_TEXT : TEXT),
      styled(row.policies, alt ? ALT_MONEY : MONEY),
      styled(row.toCome, alt ? ALT_MONEY : MONEY),
      styled(row.tds, alt ? ALT_MONEY : MONEY),
      styled(row.received, alt ? ALT_MONEY : MONEY),
      styled(row.pending, alt ? ALT_MONEY : MONEY),
    ];
  });
  const portalTotals = portals.reduce(
    (sum, row) => ({
      policies: sum.policies + row.policies,
      toCome: sum.toCome + row.toCome,
      tds: sum.tds + row.tds,
      received: sum.received + row.received,
      pending: sum.pending + row.pending,
    }),
    { policies: 0, toCome: 0, tds: 0, received: 0, pending: 0 },
  );
  const portal: XlsxSheet = {
    name: "Portal PO",
    tabColor: "B45309",
    freezeRows: 4,
    merges: ["A1:F1"],
    widths: [24, 18, 18, 16, 16, 16],
    rows: [
      [styled("Insurance Desk — Portal PO", TITLE), ...Array.from({ length: 5 }, () => styled("", TITLE))],
      [styled("Estimated portal profit, TDS paid, money received, and pending. Company names are not listed here.", NOTE)],
      [],
      portalHeader.map((header) => styled(header, HEAD)),
      ...(portalBody.length
        ? portalBody
        : [[styled("No portal earning in this range", TEXT), "", "", "", "", ""]]),
      [
        styled("TOTAL", TOTAL_TEXT),
        styled(portalTotals.policies, TOTAL_MONEY),
        styled(portalTotals.toCome, TOTAL_MONEY),
        styled(portalTotals.tds, TOTAL_MONEY),
        styled(portalTotals.received, TOTAL_MONEY),
        styled(portalTotals.pending, TOTAL_MONEY),
      ],
    ],
  };

  return [summary, report, portal];
}

/** @deprecated Use monthlyReportSheets. Kept so older callers still receive the report tab. */
export function monthlyReportSheet(opts: {
  monthLabel: string;
  from: string;
  to: string;
  data: AppData;
}): XlsxSheet {
  return monthlyReportSheets(opts)[1];
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
    sheets: monthlyReportSheets(opts),
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
