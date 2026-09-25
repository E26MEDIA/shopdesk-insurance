import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPolicyTombstones, hasExtraDeletedIds, unionDeletedIds, withoutDeletedPolicies } from "./deletedRecords";
import { mergeAppData } from "./officeMerge";
import { blankPolicy, customerBalanceDue, customerCredit } from "./types";
import { emptyData } from "./utils";

test("customer credit is a customer-side leftover, not we-pay-company minus received", () => {
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
      customerPayments: [
        { id: "1", mode: "Cash", amount: 5000 },
        { id: "2", mode: "Credit", amount: 5000 },
      ],
    }),
    5000,
  );
  assert.equal(
    customerCredit({
      received: 5000,
      customerSidePayment: 10000,
      customerPayments: [],
    }),
    5000,
  );
});

test("deleted policy ids are unioned and capped", () => {
  assert.deepEqual(unionDeletedIds(["a"], ["b", "a"], undefined), ["a", "b"]);
});

test("withoutDeletedPolicies drops tombstoned rows", () => {
  const rows = [{ id: "keep" }, { id: "gone" }];
  assert.deepEqual(withoutDeletedPolicies(rows, ["gone"]), [{ id: "keep" }]);
});

test("extra tombstones are detected and applied to remote snapshots", () => {
  const kept = { ...blankPolicy(), id: "keep", createdAt: "" };
  const gone = { ...blankPolicy(), id: "gone", createdAt: "" };
  assert.equal(hasExtraDeletedIds(["gone"], []), true);
  assert.equal(hasExtraDeletedIds(["gone"], ["gone"]), false);
  const applied = applyPolicyTombstones(
    { ...emptyData(), policies: [kept, gone] },
    ["gone"],
  );
  assert.deepEqual(
    applied.policies.map((p) => p.id),
    ["keep"],
  );
  assert.ok(applied.deletedPolicyIds?.includes("gone"));
});

test("office merge does not restore a locally deleted policy", () => {
  const kept = { ...blankPolicy(), id: "keep", createdAt: "" };
  const gone = { ...blankPolicy(), id: "gone", createdAt: "" };
  const base = { ...emptyData(), policies: [kept] };
  const mine = {
    ...emptyData(),
    policies: [kept],
    deletedPolicyIds: ["gone"],
  };
  const theirs = { ...emptyData(), policies: [kept, gone] };
  const merged = mergeAppData(base, mine, theirs);
  assert.deepEqual(
    merged.policies.map((p) => p.id),
    ["keep"],
  );
  assert.ok(merged.deletedPolicyIds?.includes("gone"));
});
