import assert from "node:assert/strict";
import { test } from "node:test";
import { unionDeletedIds, withoutDeletedPolicies } from "./deletedRecords";
import { mergeAppData } from "./officeMerge";
import { blankPolicy, customerBalanceDue } from "./types";
import { emptyData } from "./utils";

test("customer credit is payment minus what the customer paid", () => {
  assert.equal(customerBalanceDue({ received: 5000, payment: 10000 }), 5000);
  assert.equal(customerBalanceDue({ received: 10000, payment: 10000 }), 0);
  assert.equal(customerBalanceDue({ received: 12000, payment: 10000 }), 0);
});

test("deleted policy ids are unioned and capped", () => {
  assert.deepEqual(unionDeletedIds(["a"], ["b", "a"], undefined), ["a", "b"]);
});

test("withoutDeletedPolicies drops tombstoned rows", () => {
  const rows = [{ id: "keep" }, { id: "gone" }];
  assert.deepEqual(withoutDeletedPolicies(rows, ["gone"]), [{ id: "keep" }]);
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
