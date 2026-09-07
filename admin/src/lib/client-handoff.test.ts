import { describe, expect, it } from "vitest";
import { buildClientMessage } from "@/lib/client-handoff";

describe("client handoff message", () => {
  it("points shops at the public download page, not Dropbox", () => {
    const message = buildClientMessage({
      shopName: "Test Shop",
      licenseKey: "E26-INS-TEST-1234-5678",
      downloadUrl: "https://insurance.e26media.com/download",
    });

    expect(message).toContain("https://insurance.e26media.com/download");
    expect(message).not.toContain("dropbox.com");
  });
});
