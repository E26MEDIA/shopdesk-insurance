import { describe, expect, it } from "vitest";
import {
  adminDisplayUrl,
  parseLiveInstaller,
  type LiveInstaller,
} from "@/lib/live-installer";
import { dropboxFileId, installerFileName, toDirectDownloadUrl } from "@/lib/download-url";

const NEW_SHARE =
  "https://www.dropbox.com/scl/fi/ueah901plsdav9ncxfu6c/ShopDesk-Setup-0.1.3.exe?rlkey=iqum8lm2chmws0eomz5fmv7yv&st=1vmk9d62&dl=0";
const OLD_SHARE =
  "https://www.dropbox.com/scl/fi/9mkibuchzvtmtm9px2zmp/ShopDesk-Setup-0.1.0.exe?rlkey=uoxa0vj0gwx3k2qp2yyfi0s9e&st=oe25lx38&dl=0";

describe("parseLiveInstaller", () => {
  it("reads the pasted share link so admin does not snap back to an old rewritten URL", () => {
    const live = parseLiveInstaller({
      version: "0.1.3",
      downloadUrl: toDirectDownloadUrl(NEW_SHARE),
      shareUrl: NEW_SHARE,
      releaseNotes: "New installer",
      mandatoryUpdate: true,
    });
    expect(live?.version).toBe("0.1.3");
    expect(adminDisplayUrl(live as LiveInstaller)).toBe(NEW_SHARE);
    expect(dropboxFileId(adminDisplayUrl(live as LiveInstaller))).toBe(
      "ueah901plsdav9ncxfu6c",
    );
    expect(dropboxFileId(OLD_SHARE)).not.toBe(
      dropboxFileId(adminDisplayUrl(live as LiveInstaller)),
    );
  });

  it("returns null for empty or invalid JSON", () => {
    expect(parseLiveInstaller(null)).toBeNull();
    expect(parseLiveInstaller("")).toBeNull();
    expect(parseLiveInstaller("{")).toBeNull();
    expect(parseLiveInstaller({ version: "0.1.3" })).toBeNull();
  });
});

describe("installerFileName", () => {
  it("reads ShopDesk-Setup-0.1.3.exe from a Dropbox share URL", () => {
    expect(installerFileName(NEW_SHARE)).toBe("ShopDesk-Setup-0.1.3.exe");
  });
});
