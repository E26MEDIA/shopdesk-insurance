import assert from "node:assert/strict";
import { test } from "node:test";
import { excelXml, monthlyReportSheet } from "./excelDownload";
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

test("monthly download is one worksheet and keeps company offer % portal earning only", () => {
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
  const sheet = monthlyReportSheet({
    monthLabel: "September 2026",
    from: "2026-09-23",
    to: "2026-09-23",
    data,
  });
  const xml = excelXml([sheet]);
  const portalAt = sheet.rows.findIndex((row) => row[0] === "Portal PO — company offer % only");
  const portalSection = JSON.stringify(sheet.rows.slice(portalAt));
  assert.equal(sheet.name, "Report");
  assert.equal(xml.match(/<Worksheet /g)?.length, 1);
  assert.ok(portalAt > 0);
  assert.match(portalSection, /Mint/);
  assert.match(portalSection, /441/);
  assert.match(portalSection, /Ravi/);
  assert.match(portalSection, /Fresh Portal/);
  assert.equal(portalSection.includes("Direct Points"), false);
  assert.equal(portalSection.includes("Points only"), false);
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
  const sheet = monthlyReportSheet({
    monthLabel: "September 2026",
    from: "2026-09-23",
    to: "2026-09-23",
    data,
  });
  const bytes = sheetsToXlsx([sheet]);
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
