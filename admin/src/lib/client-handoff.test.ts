import { describe, expect, it } from "vitest";
import { buildClientMessage } from "./client-handoff";

describe("client handoff", () => {
  it("tells the client to paste the verification key in the installer", () => {
    const message = buildClientMessage({
      shopName: "Demo Shop",
      licenseKey: "E26-INS-TEST-1234-5678",
      downloadUrl: "https://example.com/setup.exe",
    });
    expect(message).toContain("E26-INS-TEST-1234-5678");
    expect(message).toMatch(/paste the verification key/i);
  });
});
