import assert from "node:assert/strict";
import { test } from "node:test";
import { cashPosition, portalPoRows, portalProducts, sheetRows, REPORT_HEADERS } from "./ledger";
import { blankPolicy, insExtraPoAmount, policyProfit, totalProfitWithExtra } from "./types";
import { emptyData } from "./utils";

test("decimal company offer 4.5% stays in estimated profit and out of a wrong rounding", () => {
  const policy = {
    ...blankPolicy(),
    id: "pct",
    createdAt: "",
    netPremium: 10000,
    companyOfferPercent: 4.5,
    tdsPercent: 2,
    received: 10000,
    payment: 10000,
    insExtraPo: 0,
  };
  // 10000 × 4.5% = 450; TDS 2% of 450 = 9; estimated profit 441
  assert.equal(policyProfit(policy), 441);
});

test("Ins Extra PO is added only to the last total profit", () => {
  const policy = {
    ...blankPolicy(),
    id: "extra",
    createdAt: "",
    netPremium: 10000,
    companyOfferPercent: 4.5,
    tdsPercent: 2,
    received: 10000,
    payment: 10000,
    insExtraPo: 75.5,
  };
  assert.equal(policyProfit(policy), 441);
  assert.equal(insExtraPoAmount(policy), 75.5);
  assert.equal(totalProfitWithExtra(policy), 516.5);
});

test("portal PO is automated from policies and ignores Ins Extra PO", () => {
  const data = emptyData();
  data.masters.portals = [
    { id: "mint", label: "Mint" },
    { id: "fresh", label: "Fresh Portal" },
  ];
  data.masters.companies = [{ id: "co", label: "New Co" }];
  data.policies = [
    {
      ...blankPolicy(),
      id: "1",
      createdAt: "",
      date: "2026-09-23",
      portal: "Mint",
      company: "New Co",
      netPremium: 100000,
      companyOfferPercent: 50,
      tdsPercent: 0,
      received: 0,
      payment: 0,
      insExtraPo: 1000,
    },
  ];
  data.portalReceipts = [
    {
      id: "r1",
      date: "2026-09-23",
      portal: "Mint",
      amount: 10000,
      notes: "",
      createdAt: "",
    },
  ];
  data.policies.push({
    ...blankPolicy(),
    id: "points-only",
    createdAt: "",
    date: "2026-09-23",
    portal: "Direct Points",
    company: "New Co",
    netPremium: 0,
    companyOfferPercent: 0,
    points: 800,
    tdsPercent: 0,
    insExtraPo: 50,
  });
  const rows = portalPoRows(data, "2026-09-23");
  const mint = rows.find((row) => row.name === "Mint");
  assert.ok(mint);
  assert.equal(mint?.toCome, 50000);
  assert.equal(mint?.received, 10000);
  assert.equal(mint?.pending, 40000);
  assert.equal(mint?.policies, 1);
  assert.deepEqual(mint?.companies, ["New Co"]);
  assert.equal(rows.some((row) => row.name === "Fresh Portal"), false);
  assert.equal(rows.some((row) => row.name === "Direct Points"), false);
  assert.equal(rows.some((row) => row.name === "New Co"), false);
});

test("each portal product keeps its own amount detail and leaves Ins Extra PO out of earning", () => {
  const data = emptyData();
  data.policies = [
    {
      ...blankPolicy(),
      id: "1",
      createdAt: "",
      date: "2026-09-23",
      clientName: "Ravi",
      regNo: "KA01AB1234",
      portal: "Mint",
      company: "New Co",
      netPremium: 10000,
      companyOfferPercent: 4.5,
      tdsPercent: 2,
      insExtraPo: 100,
      confirmed: true,
    },
  ];
  const [product] = portalProducts(data, "2026-09-23");
  assert.equal(product.portal, "Mint");
  assert.equal(product.party, "Ravi");
  assert.equal(product.offerPercent, 4.5);
  assert.equal(product.estimated, 441);
  assert.equal(product.insExtra, 100);
  assert.equal(product.totalProfit, 541);
});

test("closing balance adds total profit including Ins Extra PO and deducts payments and expenses", () => {
  const data = emptyData();
  data.cashOpenings = [
    { id: "o", date: "2026-09-23", amount: 200000, createdAt: "" },
  ];
  data.policies = [
    {
      ...blankPolicy(),
      id: "1",
      createdAt: "",
      date: "2026-09-23",
      portal: "Mint",
      netPremium: 10000,
      companyOfferPercent: 4.5,
      tdsPercent: 2,
      payment: 8000,
      received: 9000,
      insExtraPo: 100,
    },
  ];
  data.expenses = [
    {
      id: "h",
      date: "2026-09-23",
      amount: 500,
      sign: "-",
      description: "House",
      category: "house",
      createdAt: "",
    },
    {
      id: "s",
      date: "2026-09-23",
      amount: 300,
      sign: "-",
      description: "Shop",
      category: "office",
      createdAt: "",
    },
  ];
  const cash = cashPosition(data, "2026-09-23", "2026-09-23");
  assert.equal(cash.opening, 200000);
  assert.equal(cash.estimatedProfit, 441);
  assert.equal(cash.insExtra, 100);
  assert.equal(cash.totalProfit, 541);
  assert.equal(cash.companyPay, 8000);
  assert.equal(cash.house, -500);
  assert.equal(cash.office, -300);
  // 200000 + 541 - 8000 - 500 - 300
  assert.equal(cash.closing, 191741);
});

test("next day opening carries the previous closing until a new opening is saved", () => {
  const data = emptyData();
  data.cashOpenings = [{ id: "o", date: "2026-09-22", amount: 1000, createdAt: "" }];
  data.policies = [
    {
      ...blankPolicy(),
      id: "1",
      createdAt: "",
      date: "2026-09-22",
      points: 100,
      tdsPercent: 0,
      netPremium: 0,
      companyOfferPercent: 0,
      payment: 0,
      insExtraPo: 0,
    },
  ];
  const next = cashPosition(data, "2026-09-23", "2026-09-23");
  assert.equal(next.openingIsSet, false);
  assert.equal(next.opening, 1100);
  assert.equal(next.closing, 1100);
});

test("report sheet keeps the uploaded columns and adds payout detail without customer side", () => {
  assert.equal(REPORT_HEADERS[0], "ISSUED Date");
  assert.equal(REPORT_HEADERS[9], "Ins Extra PO");
  assert.equal(REPORT_HEADERS[10], "TOTAL PROFIT");
  assert.equal(REPORT_HEADERS.includes("Customer side payment" as never), false);
  const rows = sheetRows({
    policies: [
      {
        ...blankPolicy(),
        id: "1",
        createdAt: "2026-09-23T00:00:00.000Z",
        date: "2026-09-23",
        clientName: "abc",
        insExtraPo: 25,
        points: 100,
        tdsPercent: 0,
      },
    ],
    expenses: [],
    receipts: [],
    opening: 200000,
    closing: 200125,
  });
  assert.equal(rows[0].party, "abc");
  assert.equal(rows[0].insExtra, 25);
  assert.equal(rows[0].estimatedProfit, 100);
  assert.equal(rows[0].totalProfit, 125);
  assert.equal(rows[0].openClose, 200000);
});
