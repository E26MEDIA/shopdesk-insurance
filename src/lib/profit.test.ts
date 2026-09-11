import assert from "node:assert/strict";
import { test } from "node:test";
import { blankPolicy, policyProfit, tdsAmount, usesPointsProfit } from "./types";

test("percent offer: 5000 at 50% minus 500 discount then 2% TDS is 1960", () => {
  const p = {
    ...blankPolicy(),
    id: "1",
    createdAt: "",
    netPremium: 5000,
    companyOfferPercent: 50,
    received: 10000,
    payment: 10500,
    tdsPercent: 2,
    points: 0,
  };
  // offer 2500 − discount 500 = 2000; TDS 2% of 2000 = 40; profit 1960
  assert.equal(usesPointsProfit(p), false);
  assert.equal(tdsAmount(p), 40);
  assert.equal(policyProfit(p), 1960);
});

test("points path: TDS % is taken directly from points", () => {
  const p = {
    ...blankPolicy(),
    id: "2",
    createdAt: "",
    netPremium: 0,
    companyOfferPercent: 0,
    points: 500,
    tdsPercent: 2,
    received: 0,
    payment: 0,
  };
  assert.equal(usesPointsProfit(p), true);
  assert.equal(tdsAmount(p), 10);
  assert.equal(policyProfit(p), 490);
});

test("percent offer wins when both net premium % and points are filled", () => {
  const p = {
    ...blankPolicy(),
    id: "3",
    createdAt: "",
    netPremium: 10000,
    companyOfferPercent: 10,
    points: 500,
    tdsPercent: 0,
    received: 10000,
    payment: 10000,
  };
  assert.equal(usesPointsProfit(p), false);
  assert.equal(policyProfit(p), 1000);
});
