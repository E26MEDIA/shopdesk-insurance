import assert from "node:assert/strict";
import { test } from "node:test";
import { blankPolicy, policyProfit, tdsAmount, usesPointsProfit } from "./types";

test("percent offer: discount then TDS % of remaining is actual profit", () => {
  const p = {
    ...blankPolicy(),
    id: "1",
    createdAt: "",
    netPremium: 9800,
    companyOfferPercent: 7,
    received: 10500,
    payment: 10700,
    tdsPercent: 2,
    points: 0,
  };
  // offer 686 − extra 200 = 486; TDS 2% of 486 = 9.72; profit 476.28
  assert.equal(usesPointsProfit(p), false);
  assert.equal(tdsAmount(p), 9.72);
  assert.equal(policyProfit(p), 476.28);
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
