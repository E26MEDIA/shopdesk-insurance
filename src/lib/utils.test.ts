import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dateKey,
  documentFolderName,
  inDateRange,
  monthRange,
} from "./utils";

test("documentFolderName follows customer + variant + policy", () => {
  assert.equal(
    documentFolderName({
      clientName: "suresh",
      variant: "2W",
      portal: "Policybazar",
    }),
    "suresh2W Policybazar",
  );
  assert.equal(
    documentFolderName({
      clientName: "suresh",
      vehicleMode: "2 Wheeler",
      portal: "Policybazar",
    }),
    "suresh2Wheeler Policybazar",
  );
  assert.equal(documentFolderName({ clientName: "" }), "Unknown Customer");
});

test("dateKey keeps YYYY-MM-DD even when a time suffix is present", () => {
  assert.equal(dateKey("2026-08-12T18:00:00.000Z"), "2026-08-12");
  assert.equal(dateKey("2026-09-08"), "2026-09-08");
  assert.equal(dateKey(""), "");
});

test("inDateRange includes the From and To days", () => {
  assert.equal(inDateRange("2026-08-12", "2026-08-12", "2026-09-08"), true);
  assert.equal(inDateRange("2026-09-08", "2026-08-12", "2026-09-08"), true);
  assert.equal(inDateRange("2026-08-11", "2026-08-12", "2026-09-08"), false);
  assert.equal(inDateRange("2026-09-09", "2026-08-12", "2026-09-08"), false);
  assert.equal(inDateRange("2026-08-15T00:00:00.000Z", "2026-08-12", "2026-09-08"), true);
});

test("monthRange returns the local calendar month", () => {
  const { from, to } = monthRange(0, new Date(2026, 8, 8));
  assert.equal(from, "2026-09-01");
  assert.equal(to, "2026-09-30");
  const last = monthRange(-1, new Date(2026, 8, 8));
  assert.equal(last.from, "2026-08-01");
  assert.equal(last.to, "2026-08-31");
});
