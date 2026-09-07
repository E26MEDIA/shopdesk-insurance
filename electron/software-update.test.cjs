const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  compareVersions,
  decideUpdate,
  checkForSoftwareUpdate,
  downloadPageUrl,
  downloadInstaller,
  createUpdateManager,
  isWindowsInstaller,
  launchInstaller,
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

function fakeExeBuffer() {
  const buf = Buffer.alloc(128, 0);
  buf[0] = 0x4d;
  buf[1] = 0x5a;
  buf.write("ShopDesk installer", 4);
  return buf;
}

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

test("downloadInstaller follows redirects and saves a Windows installer", async () => {
  const payload = fakeExeBuffer();
  const { server, port } = await listen((req, res) => {
    if (req.url === "/go") {
      res.writeHead(302, { Location: "/file.exe" });
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": payload.length,
    });
    res.end(payload);
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-update-"));
  const dest = path.join(dir, "ShopDesk-Setup-0.2.0.exe");
  try {
    const percents = [];
    const result = await downloadInstaller(
      `http://127.0.0.1:${port}/go`,
      dest,
      (p) => percents.push(p.percent),
    );
    assert.equal(result.path, dest);
    assert.equal(isWindowsInstaller(dest), true);
    assert.ok(percents.includes(100));
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("downloadInstaller extracts a Windows installer from a zip", async () => {
  const { zipSingleFile } = require("../scripts/zip-stored-file.cjs");
  const payload = fakeExeBuffer();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-update-zip-"));
  const inner = path.join(dir, "ShopDesk-Setup-0.1.1.exe");
  const zipPath = path.join(dir, "payload.zip");
  fs.writeFileSync(inner, payload);
  zipSingleFile(inner, zipPath, "ShopDesk-Setup-0.1.1.exe");
  const zipBytes = fs.readFileSync(zipPath);
  const { server, port } = await listen((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": zipBytes.length,
    });
    res.end(zipBytes);
  });
  const dest = path.join(dir, "ShopDesk-Setup-0.2.0.exe");
  try {
    const result = await downloadInstaller(
      `http://127.0.0.1:${port}/ShopDesk-Setup-0.2.0.exe.zip`,
      dest,
    );
    assert.equal(result.path, dest);
    assert.equal(isWindowsInstaller(dest), true);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("downloadInstaller rejects HTML that is not an installer", async () => {
  const { server, port } = await listen((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html>login</html>");
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-update-"));
  const dest = path.join(dir, "ShopDesk-Setup-0.2.0.exe");
  try {
    await assert.rejects(
      downloadInstaller(`http://127.0.0.1:${port}/file.exe`, dest),
      /not a Windows installer/,
    );
    assert.equal(fs.existsSync(dest), false);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("update manager downloads once then reports ready", async () => {
  const payload = fakeExeBuffer();
  const { server, port } = await listen((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": payload.length,
    });
    res.end(payload);
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-update-"));
  try {
    const manager = createUpdateManager({ updatesDir: dir });
    const first = await manager.ensureDownloaded({
      version: "0.2.0",
      downloadUrl: `http://127.0.0.1:${port}/ShopDesk-Setup-0.2.0.exe`,
    });
    assert.equal(first.status, "ready");
    assert.equal(isWindowsInstaller(first.path), true);
    const second = await manager.ensureDownloaded({
      version: "0.2.0",
      downloadUrl: `http://127.0.0.1:${port}/ShopDesk-Setup-0.2.0.exe`,
    });
    assert.equal(second.status, "ready");
    assert.equal(second.path, first.path);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("launchInstaller opens the downloaded file and refuses missing files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-update-"));
  const dest = path.join(dir, "ShopDesk-Setup-0.2.0.exe");
  fs.writeFileSync(dest, fakeExeBuffer());
  const opened = [];
  try {
    const result = await launchInstaller(dest, async (file) => {
      opened.push(file);
    });
    assert.equal(result.ok, true);
    assert.deepEqual(opened, [dest]);
    await assert.rejects(launchInstaller(path.join(dir, "missing.exe"), async () => {}), /not downloaded/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

