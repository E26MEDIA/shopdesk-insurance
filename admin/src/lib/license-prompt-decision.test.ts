import { describe, expect, it } from "vitest";
import { licensePromptDecision } from "../../../src/licensing/license-gate-logic";

describe("license prompt decision", () => {
  it("always shows checking while the first status request is in flight", () => {
    expect(
      licensePromptDecision({
        hasShopdesk: false,
        hostname: "shopdesk-insurance.vercel.app",
        checking: true,
        status: null,
      }),
    ).toBe("checking");
  });

  it("allows the hosted browser demo without a key", () => {
    expect(
      licensePromptDecision({
        hasShopdesk: false,
        hostname: "shopdesk-insurance.vercel.app",
        checking: false,
        status: null,
      }),
    ).toBe("allow");
  });

  it("does not unlock localhost if the desktop bridge is missing", () => {
    expect(
      licensePromptDecision({
        hasShopdesk: false,
        hostname: "127.0.0.1",
        checking: false,
        status: null,
      }),
    ).toBe("activation");
  });

  it("asks for a verification key when the desktop app is not activated", () => {
    expect(
      licensePromptDecision({
        hasShopdesk: true,
        hostname: "127.0.0.1",
        checking: false,
        status: { valid: false, needsActivation: true },
      }),
    ).toBe("activation");
  });
});
