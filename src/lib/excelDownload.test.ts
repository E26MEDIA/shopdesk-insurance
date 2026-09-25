import assert from "node:assert/strict";
import { test } from "node:test";
import { excelXml, monthlyReportSheets } from "./excelDownload";
import { sheetsToXlsx } from "./xlsx";
import { blankPolicy, expenseCategory, expenseNet, type Expense } from "./types";
import { emptyData } from "./utils";

test("expenseCategory treats missing values as office and keeps house separate", () => {
  assert.equal(expenseCategory({ category: "house" }), "house");
  assert.equal(expenseCategory({ category: "office" }), "office");
  assert.equal(expenseCategory({ category: undefined as never }), "office");
});

test("expenseNet adds house and office signed amounts independently", () => {
  const house: Expense[] = [
    {
      id: "h1",
      date: "2026-09-08",
      amount: 1200,
      sign: "-",
      description: "House rent",
      category: "house",
      createdAt: "2026-09-08T00:00:00.000Z",
    },
  ];
  const office: Expense[] = [
    {
      id: "o1",
      date: "2026-09-08",
      amount: 500,
      sign: "-",
      description: "Office tea",
      category: "office",
      createdAt: "2026-09-08T00:00:00.000Z",
    },
  ];
  assert.equal(expenseNet(house), -1200);
  assert.equal(expenseNet(office), -500);
  assert.equal(expenseNet([...house, ...office]), -1700);
});

test("excelXml keeps house and office as separate worksheets", () => {
  const xml = excelXml([
    { name: "House expenses", rows: [["Date", "Amount"], ["2026-09-08", 1200]] },
    { name: "Office expenses", rows: [["Date", "Amount"], ["2026-09-08", 500]] },
  ]);
  assert.match(xml, /ss:Name="House expenses"/);
  assert.match(xml, /ss:Name="Office expenses"/);
  assert.match(xml, />1200</);
  assert.match(xml, />500</);
});

test("monthly download is three sheets: summary, report, then portal PO without company names", () => {
  const data = emptyData();
  data.masters.portals = [
    { id: "mint", label: "Mint" },
    { id: "fresh", label: "Fresh Portal" },
  ];
  data.policies = [
    {
      ...blankPolicy(),
      id: "1",
      createdAt: "",
      date: "2026-09-23",
      clientName: "Ravi",
      portal: "Mint",
      company: "New Co",
      netPremium: 10000,
      companyOfferPercent: 4.5,
      tdsPercent: 2,
      insExtraPo: 100,
    },
    {
      ...blankPolicy(),
      id: "2",
      createdAt: "",
      date: "2026-09-23",
      clientName: "Points only",
      portal: "Direct Points",
      points: 500,
      companyOfferPercent: 0,
      netPremium: 0,
    },
  ];
  data.portalReceipts = [
    { id: "r1", date: "2026-09-23", portal: "Mint", amount: 200, notes: "", createdAt: "" },
  ];
  const sheets = monthlyReportSheets({
    monthLabel: "September 2026",
    from: "2026-09-23",
    to: "2026-09-23",
    data,
  });
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Summary", "Report", "Portal PO"]);
  const summaryText = JSON.stringify(sheets[0].rows);
  const reportText = JSON.stringify(sheets[1].rows);
  const portalText = JSON.stringify(sheets[2].rows);
  assert.match(summaryText, /Total profit/);
  assert.match(summaryText, /1031/);
  assert.match(summaryText, /Total TDS paid/);
  assert.match(reportText, /ISSUED Date/);
  assert.match(reportText, /Ravi/);
  assert.match(reportText, /1031/);
  assert.equal(reportText.includes("Portal PO"), false);
  assert.match(portalText, /Mint/);
  assert.match(portalText, /441/);
  assert.match(portalText, /Direct Points/);
  assert.equal(portalText.includes("New Co"), false);
  assert.equal(portalText.includes("Ravi"), false);
  assert.equal(portalText.includes("Fresh Portal"), false);
  const bytes = sheetsToXlsx(sheets);
  const workbook = new TextDecoder().decode(bytes);
  assert.equal(workbook.match(/<worksheet /g)?.length, 3);
  assert.match(workbook, /name="Summary"/);
  assert.match(workbook, /fgColor rgb="FF0F3D3E"/);
});

test("xlsx download is a real workbook with the detail columns in cells", () => {
  const data = emptyData();
  data.policies = [
    {
      ...blankPolicy(),
      id: "1",
      createdAt: "",
      date: "2026-09-23",
      clientName: "shaim",
      regNo: "KA19HR4884",
      portal: "PolicyBazaar",
      company: "ICICI Lombard",
      netPremium: 1180,
      companyOfferPercent: 60,
      tdsPercent: 2,
      insExtraPo: 100,
      received: 10000,
      payment: 1150,
    },
  ];
  const sheets = monthlyReportSheets({
    monthLabel: "September 2026",
    from: "2026-09-23",
    to: "2026-09-23",
    data,
  });
  const bytes = sheetsToXlsx(sheets);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /<worksheet /);
  assert.match(text, /ISSUED Date/);
  assert.match(text, />shaim</);
  assert.match(text, />693\.84</);
  assert.equal(text.includes("<?mso-application"), false);
  assert.equal(text.startsWith("<?xml"), false);
});
