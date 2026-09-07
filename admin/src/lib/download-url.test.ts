import { describe, expect, it } from "vitest";
import { toDirectDownloadUrl, isPlausibleInstallerSize } from "@/lib/download-url";

describe("toDirectDownloadUrl", () => {
  it("turns a Dropbox share preview link into a direct file download", () => {
    const live =
      "https://www.dropbox.com/scl/fi/9mkibuchzvtmtm9px2zmp/ShopDesk-Setup-0.1.0.exe?rlkey=uoxa0vj0gwx3k2qp2yyfi0s9e&st=oe25lx38&dl=0";

    expect(toDirectDownloadUrl(live)).toBe(
      "https://www.dropbox.com/scl/fi/9mkibuchzvtmtm9px2zmp/ShopDesk-Setup-0.1.0.exe?rlkey=uoxa0vj0gwx3k2qp2yyfi0s9e&dl=1",
    );
  });

  it("converts classic Dropbox /s/ share links", () => {
    expect(
      toDirectDownloadUrl(
        "https://www.dropbox.com/s/xxxxx/ShopDesk-Setup-0.1.0.exe?dl=0",
      ),
    ).toBe(
      "https://www.dropbox.com/s/xxxxx/ShopDesk-Setup-0.1.0.exe?dl=1",
    );
  });

  it("turns dropboxusercontent share links back into www.dropbox.com dl=1", () => {
    expect(
      toDirectDownloadUrl(
        "https://dl.dropboxusercontent.com/scl/fi/abc/file.exe?rlkey=zzz&dl=0",
      ),
    ).toBe("https://www.dropbox.com/scl/fi/abc/file.exe?rlkey=zzz&dl=1");
  });

  it("does not rewrite temporary Dropbox CDN hosts", () => {
    const cdn =
      "https://uc123.dl.dropboxusercontent.com/cd/0/get/file?dl=1";
    expect(toDirectDownloadUrl(cdn)).toBe(cdn);
  });

  it("converts Google Drive view links to export=download", () => {
    expect(
      toDirectDownloadUrl(
        "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
      ),
    ).toBe("https://drive.google.com/uc?export=download&id=FILE_ID");
  });

  it("leaves already-direct Drive links and other URLs alone", () => {
    expect(
      toDirectDownloadUrl(
        "https://drive.google.com/uc?export=download&id=FILE_ID",
      ),
    ).toBe("https://drive.google.com/uc?export=download&id=FILE_ID");
    expect(
      toDirectDownloadUrl(
        "https://insurance.e26media.com/downloads/ShopDesk-Setup-0.1.0.exe",
      ),
    ).toBe("https://insurance.e26media.com/downloads/ShopDesk-Setup-0.1.0.exe");
  });

  it("returns null for empty values", () => {
    expect(toDirectDownloadUrl(null)).toBeNull();
    expect(toDirectDownloadUrl("")).toBeNull();
    expect(toDirectDownloadUrl("   ")).toBeNull();
  });
});

describe("isPlausibleInstallerSize", () => {
  it("rejects HTML-sized responses and accepts a real installer", () => {
    expect(isPlausibleInstallerSize(12_000)).toBe(false);
    expect(isPlausibleInstallerSize(162_188_385)).toBe(true);
  });
});
