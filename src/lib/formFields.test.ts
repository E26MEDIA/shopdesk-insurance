import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeFormFields } from "./formFields";

test("vehicle mode and portal stay searchable selects; variant stays a blank type-in", () => {
  const merged = mergeFormFields([
    {
      id: "f_vehicleMode",
      key: "vehicleMode",
      label: "Model",
      type: "text",
      enabled: true,
      required: false,
      order: 90,
    },
    {
      id: "f_variant",
      key: "variant",
      label: "Variant",
      type: "select",
      enabled: true,
      required: false,
      masterType: "variants",
      order: 100,
    },
    {
      id: "f_portal",
      key: "portal",
      label: "Portal",
      type: "text",
      enabled: true,
      required: false,
      order: 110,
    },
  ]);
  const vehicleMode = merged.find((f) => f.key === "vehicleMode");
  const variant = merged.find((f) => f.key === "variant");
  const portal = merged.find((f) => f.key === "portal");
  assert.equal(vehicleMode?.type, "select");
  assert.equal(vehicleMode?.masterType, "vehicleModes");
  assert.equal(variant?.type, "text");
  assert.equal(variant?.masterType, undefined);
  assert.equal(portal?.type, "select");
  assert.equal(portal?.masterType, "portals");
  assert.ok(merged.some((f) => f.key === "customerSidePayment"));
});
