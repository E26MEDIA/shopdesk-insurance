const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const {
  compareVersions,
  decideUpdate,
  checkForSoftwareUpdate,
  downloadPageUrl,
} = require("./software-update.cjs");

test("compareVersions orders semver numbers", () => {
  assert.equal(compareVersions("0.2.0", "0.1.0"), 1);
  assert.equal(compareVersions("0.1.0", "0.2.0"), -1);
  assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
  assert.equal(compareVersions("v1.0.0", "0.9.9"), 1);
  assert.equal(compareVersions("0.1.10", "0.1.9"), 1);
});

test("decideUpdate hides popup when already on latest", () => {
  const result = decideUpdate({
    currentVersion: "0.1.0",
    latestVersion: "0.1.0",
    downloadUrl: "https://example.com/setup.exe",
  });
  assert.equal(result.available, false);
  assert.equal(result.mandatory, false);
});

test("decideUpdate shows optional popup when website publishes a newer version", () => {
  const result = decideUpdate({
    currentVersion: "0.1.0",
    latestVersion: "0.2.0",
    downloadUrl: "https://example.com/setup.exe",
    releaseNotes: "Faster reports",
    mandatoryUpdate: false,
  });
  assert.equal(result.available, true);
  assert.equal(result.mandatory, false);
  assert.equal(result.latestVersion, "0.2.0");
  assert.equal(result.releaseNotes, "Faster reports");
});

test("decideUpdate forces update below minimum supported version", () => {
  const result = decideUpdate({
    currentVersion: "0.1.0",
    latestVersion: "0.3.0",
    minimumSupportedVersion: "0.2.0",
    mandatoryUpdate: false,
  });
  assert.equal(result.available, true);
  assert.equal(result.mandatory, true);
});

test("downloadPageUrl uses website origin from license API", () => {
  assert.equal(
    downloadPageUrl("https://insurance.e26media.com/api/v1"),
    "https://insurance.e26media.com/download",
  );
});

test("checkForSoftwareUpdate reads latest version from website API", async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.method, "GET");
    assert.equal(req.url, "/software/latest");
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        version: "0.4.0",
        downloadUrl: "https://example.com/ShopDesk-Setup-0.4.0.exe",
        releaseNotes: "In-app update popup",
        mandatoryUpdate: true,
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const result = await checkForSoftwareUpdate(
      "0.1.0",
      `http://127.0.0.1:${port}`,
    );
    assert.equal(result.available, true);
    assert.equal(result.mandatory, true);
    assert.equal(result.latestVersion, "0.4.0");
    assert.equal(result.downloadUrl, "https://example.com/ShopDesk-Setup-0.4.0.exe");
    assert.equal(result.error, null);
  } finally {
    server.close();
  }
});

test("checkForSoftwareUpdate fails closed when website is unreachable", async () => {
  const result = await checkForSoftwareUpdate(
    "0.1.0",
    "http://127.0.0.1:1",
  );
  assert.equal(result.available, false);
  assert.ok(result.error);
});
