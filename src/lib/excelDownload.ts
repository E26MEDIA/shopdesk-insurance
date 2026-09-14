import {
  customerBalanceDue,
  expenseCategory,
  expenseNet,
  expenseSignedAmount,
  policyProfit,
  tdsAmount,
  type Expense,
  type Policy,
  type PucEntry,
} from "./types";
import { isOfflineDesktop } from "./persist";

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
  policies: Policy[];
  pucEntries: PucEntry[];
  expenses: Expense[];
  date?: string;
  silent?: boolean;
}): Promise<{ path?: string; fileName?: string } | null> {
  const { monthLabel, from, to, policies, pucEntries, expenses } = opts;
  const received = policies.reduce((s, p) => s + (p.received || 0), 0);
  const payout = policies.reduce((s, p) => s + (p.payment || 0), 0);
  const balanceDue = policies.reduce((s, p) => s + customerBalanceDue(p), 0);
  const tds = policies.reduce((s, p) => s + tdsAmount(p), 0);
  const insuranceProfit = policies.reduce((s, p) => s + policyProfit(p), 0);
  const pucIncome = pucEntries.reduce((s, p) => s + (p.amount || 0), 0);
  const house = expenses.filter((e) => expenseCategory(e) === "house");
  const office = expenses.filter((e) => expenseCategory(e) === "office");
  const houseNet = expenseNet(house);
  const officeNet = expenseNet(office);
  const expenseTotal = houseNet + officeNet;
  const totalProfit = insuranceProfit + pucIncome + expenseTotal;

  return downloadExcelFile({
      kind: "monthly-report",
      date: opts.date || to || from,
      silent: opts.silent,
    sheets: [
      {
        name: "Summary",
        rows: [
          ["ShopDesk monthly report"],
          [monthLabel, `${from} to ${to}`],
          [],
          ["Item", "Amount"],
          ["Insurance entries", policies.length],
          ["Received from customers", received],
          ["Paid to companies", payout],
          ["Customer balance due", balanceDue],
          ["TDS deducted", tds],
          ["Insurance profit", insuranceProfit],
          ["PUC income", pucIncome],
          ["House expenses (+/−)", houseNet],
          ["Office expenses (+/−)", officeNet],
          ["Expenses total (+/−)", expenseTotal],
          ["Total profit", totalProfit],
        ],
      },
      {
        name: "Insurance",
        rows: [
          ["Date", "Client", "Phone", "Vehicle", "Company", "Received", "Payout", "Balance due", "Profit"],
          ...policies.map((p) => [
            p.date,
            p.clientName || "",
            p.phone || p.contact || "",
            p.regNo || "",
            p.company || "",
            p.received || 0,
            p.payment || 0,
            customerBalanceDue(p),
            policyProfit(p),
          ]),
        ],
      },
      {
        name: "PUC",
        rows: [
          ["Date", "Client", "Vehicle", "Mode", "Amount", "Notes"],
          ...pucEntries.map((p) => [
            p.date,
            p.clientName || "",
            p.regNo || "",
            p.vehicleMode || "",
            p.amount || 0,
            p.notes || "",
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
            "Balance due",
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
            customerBalanceDue(p),
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
