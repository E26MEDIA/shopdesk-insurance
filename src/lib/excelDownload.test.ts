import assert from "node:assert/strict";
import { test } from "node:test";
import { excelXml } from "./excelDownload";
import { expenseCategory, expenseNet, type Expense } from "./types";

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
