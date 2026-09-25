import assert from "node:assert/strict";
import { test } from "node:test";
import { blankPolicy, customerBalanceDue, customerCredit, policyProfit, tdsAmount, usesPointsProfit } from "./types";

test("percent offer: TDS % of company profit, then discount", () => {
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
  // company profit 2500; TDS 2% of 2500 = 50; then discount 500; profit 1950
  assert.equal(usesPointsProfit(p), false);
  assert.equal(tdsAmount(p), 50);
  assert.equal(policyProfit(p), 1950);
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

test("points path: discount is taken after TDS on company profit", () => {
  const p = {
    ...blankPolicy(),
    id: "2b",
    createdAt: "",
    netPremium: 0,
    companyOfferPercent: 0,
    points: 500,
    tdsPercent: 2,
    received: 10000,
    payment: 10100,
  };
  assert.equal(usesPointsProfit(p), true);
  assert.equal(tdsAmount(p), 10);
  assert.equal(policyProfit(p), 390);
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

test("customer credit is unpaid customer-side payment, not company payout", () => {
  assert.equal(
    customerBalanceDue({
      received: 5000,
      customerSidePayment: 0,
      customerPayments: [],
    }),
    0,
  );
  assert.equal(
    customerCredit({
      received: 5000,
      customerSidePayment: 10000,
      customerPayments: [],
    }),
    0,
  );
  assert.equal(
    customerCredit({
      received: 5000,
      customerSidePayment: 10000,
      customerPayments: [
        { id: "1", mode: "Cash", amount: 5000 },
        { id: "2", mode: "Credit", amount: 5000 },
      ],
    }),
    5000,
  );
  const p = {
    ...blankPolicy(),
    id: "credit-not-payout",
    createdAt: "",
    customerSidePayment: 10000,
    received: 5000,
    payment: 8000,
    netPremium: 0,
    companyOfferPercent: 0,
    points: 500,
    tdsPercent: 2,
    customerPayments: [
      { id: "1", mode: "Cash", amount: 5000 },
      { id: "2", mode: "Credit", amount: 5000 },
    ],
  };
  assert.equal(customerCredit(p), 5000);
  assert.equal(policyProfit(p), 490);
});
