const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  savePendingKey,
  loadPendingKey,
  clearPendingKey,
  findPendingKey,
} = require("./token-store.cjs");
const { getLicenseStatus } = require("./license-service.cjs");

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), name));
}

describe("pending verification key store", () => {
  it("saves, loads, and clears a pending key", () => {
    const root = tempDir("shopdesk-pending-");
    assert.equal(loadPendingKey(root), "");
    savePendingKey(root, "  e26-ins-abcd-efgh-ijkl  ");
    assert.equal(loadPendingKey(root), "e26-ins-abcd-efgh-ijkl");
    clearPendingKey(root);
    assert.equal(loadPendingKey(root), "");
  });

  it("finds a key written to an installer fallback folder", () => {
    const dataRoot = tempDir("shopdesk-data-");
    const installerRoot = tempDir("shopdesk-fallback-");
    savePendingKey(installerRoot, "E26-INS-TEST-KEY1-KEY2");
    const found = findPendingKey(dataRoot, [installerRoot]);
    assert.equal(found.key, "E26-INS-TEST-KEY1-KEY2");
    assert.equal(path.resolve(found.root), path.resolve(installerRoot));
  });
});

describe("license status before activation", () => {
  it("requires a verification key when no token is stored", async () => {
    const root = tempDir("shopdesk-status-");
    const status = await getLicenseStatus(root, { allowSkip: false });
    assert.equal(status.valid, false);
    assert.equal(status.needsActivation, true);
    assert.match(String(status.message), /verification key/i);
  });

  it("does not skip licensing in packaged mode even if skip env is set", async () => {
    const root = tempDir("shopdesk-noskip-");
    const status = await getLicenseStatus(root, { allowSkip: false });
    assert.equal(status.skip, undefined);
    assert.equal(status.valid, false);
  });
});
