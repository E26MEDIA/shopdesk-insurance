const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("child_process");
const http = require("http");
const dgram = require("dgram");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DISCOVER_PROBE, decodeDiscoverReply } = require("./office-network.cjs");

function listenPort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function waitForHealth(port, attempts = 40) {
  return new Promise((resolve, reject) => {
    const tick = () => {
      request(`http://127.0.0.1:${port}/health`).then((res) => {
        if (res.status === 200) resolve();
        else retry();
      }).catch(retry);
    };
    const retry = () => {
      attempts -= 1;
      if (attempts <= 0) reject(new Error("Office server did not start"));
      else setTimeout(tick, 100);
    };
    tick();
  });
}

function startOfficeServer() {
  return Promise.all([listenPort(), listenPort()]).then(async ([port, discoverPort]) => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-office-"));
    const child = spawn(process.execPath, [path.join(__dirname, "office-server.cjs")], {
      env: {
        ...process.env,
        SHOPDESK_OFFICE_PORT: String(port),
        SHOPDESK_OFFICE_DISCOVER_PORT: String(discoverPort),
        SHOPDESK_OFFICE_DATA_DIR: dataDir,
      },
      stdio: "ignore",
    });
    try {
      await waitForHealth(port);
      return { child, port, discoverPort, dataDir };
    } catch (error) {
      child.kill("SIGKILL");
      throw error;
    }
  });
}

function stopOfficeServer(started) {
  try { started.child.kill("SIGKILL"); } catch { /* ignore */ }
  try { fs.rmSync(started.dataDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

test("health is reachable and CORS preflight allows office headers", async (t) => {
  const started = await startOfficeServer();
  t.after(() => stopOfficeServer(started));

  const health = await request(`http://127.0.0.1:${started.port}/health`);
  assert.equal(health.status, 200);
  const json = JSON.parse(health.body);
  assert.equal(json.ok, true);
  assert.equal(json.port, started.port);
  assert.equal(health.headers["access-control-allow-origin"], "*");
  assert.match(health.headers["access-control-allow-headers"], /x-shopdesk-office-key/i);
  assert.equal(health.headers["access-control-allow-private-network"], "true");

  const preflight = await request(`http://127.0.0.1:${started.port}/api/v1/data`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:3456",
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type,if-match,x-shopdesk-device,x-shopdesk-label,x-shopdesk-office-key",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers["access-control-allow-headers"], /x-shopdesk-office-key/i);
  assert.equal(preflight.headers["access-control-allow-private-network"], "true");
});

test("UDP discovery replies with the office server location", async (t) => {
  const started = await startOfficeServer();
  t.after(() => stopOfficeServer(started));

  const reply = await new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("No discovery reply"));
    }, 2000);
    socket.on("message", (message) => {
      clearTimeout(timer);
      socket.close();
      resolve(decodeDiscoverReply(message));
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.send(Buffer.from(DISCOVER_PROBE), started.discoverPort, "127.0.0.1");
  });

  assert.ok(reply);
  assert.equal(reply.port, started.port);
});
