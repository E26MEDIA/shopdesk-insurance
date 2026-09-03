const electron = require("electron");
const { app, BrowserWindow, ipcMain, shell } = electron;

if (!app) {
  console.error(
    "ShopDesk must be started with Electron.\nRun: npm run desktop\n(Do not set ELECTRON_RUN_AS_NODE=1)",
  );
  process.exit(1);
}

const path = require("path");
const fs = require("fs");
const http = require("http");
const dgram = require("dgram");
const { spawn } = require("child_process");
const {
  activateLicense: activateLicenseRemote,
  refreshLicense,
  getLicenseStatus,
} = require("./licensing/license-service.cjs");
const {
  OFFICE_PORT,
  DISCOVER_PORT,
  DISCOVER_PROBE,
  lanAddresses,
  lanUrls,
  broadcastAddresses,
  subnetPrefixes,
  normalizeOfficeServerUrl,
  isLoopbackOfficeUrl,
  decodeDiscoverReply,
} = require("../server/office-network.cjs");

const PORT = Number(process.env.SHOPDESK_PORT || 3456);
const isDev = !app.isPackaged;

/** @type {import('child_process').ChildProcess | null} */
let nextProcess = null;
/** @type {import('child_process').ChildProcess | null} */
let officeServerProcess = null;
/** @type {string} */
let lastServerError = "";

const PREFERRED_FILES_ROOT =
  process.env.SHOPDESK_SHARED_ROOT || "E:\\insurance desk";

/** @type {string | null} */
let cachedFilesRoot = null;
/** @type {string | null} */
let cachedDocsRoot = null;

function localDataRoot() {
  const dir = path.join(app.getPath("userData"), "shopdesk-data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filesRoot() {
  if (cachedFilesRoot) return cachedFilesRoot;
  try {
    fs.mkdirSync(PREFERRED_FILES_ROOT, { recursive: true });
    fs.accessSync(PREFERRED_FILES_ROOT, fs.constants.W_OK);
    cachedFilesRoot = PREFERRED_FILES_ROOT;
  } catch {
    cachedFilesRoot = path.join(localDataRoot(), "files");
    fs.mkdirSync(cachedFilesRoot, { recursive: true });
  }
  return cachedFilesRoot;
}

function dataDir() {
  // Keep app database private in AppData — never inside E:\insurance desk
  return localDataRoot();
}

function dataFile() {
  return path.join(dataDir(), "data.json");
}

function migrateLegacyDataIfNeeded() {
  const local = dataFile();
  const onEdrive = path.join(PREFERRED_FILES_ROOT, "data.json");
  try {
    if (!fs.existsSync(local) && fs.existsSync(onEdrive)) {
      fs.copyFileSync(onEdrive, local);
    }
  } catch {
    /* ignore */
  }
  // Remove data.json / lock from insurance desk folder (user files only there)
  for (const name of ["data.json", ".data.lock"]) {
    const p = path.join(PREFERRED_FILES_ROOT, name);
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

function sanitizeFolderName(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  return cleaned || "Unknown Customer";
}

function sanitizeFileName(name) {
  const cleaned = String(name || "file")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return cleaned || "file";
}

function docsRoot() {
  if (cachedDocsRoot) return cachedDocsRoot;
  const preferred = path.join(filesRoot(), "docs");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    cachedDocsRoot = preferred;
  } catch {
    const fallback = path.join(localDataRoot(), "docs");
    fs.mkdirSync(fallback, { recursive: true });
    cachedDocsRoot = fallback;
  }
  return cachedDocsRoot;
}

function reportsRoot() {
  const dir = path.join(filesRoot(), "report", "daily report");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function deleteMetaSidecars(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deleteMetaSidecars(full);
      continue;
    }
    if (
      entry.isFile() &&
      (entry.name.endsWith(".meta.json") || entry.name.endsWith(".meta"))
    ) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }
}

function sanitizeReportName(name) {
  return (
    String(name || "report")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "report"
  );
}

async function savePdfFromHtml(html, opts = {}) {
  const reportDate =
    String(opts.date || new Date().toISOString().slice(0, 10)).slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const kind = sanitizeReportName(opts.kind || "report");
  const dir = reportsRoot();
  const fileName = `${reportDate}_${kind}.pdf`;
  const outPath = path.join(dir, fileName);

  const tmpHtml = path.join(
    app.getPath("temp"),
    `shopdesk-report-${Date.now()}.html`,
  );
  fs.writeFileSync(tmpHtml, html, "utf8");

  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await win.loadFile(tmpHtml);
    // Wait for layout
    await new Promise((r) => setTimeout(r, 400));
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: "A4",
      margins: {
        marginType: "default",
      },
    });
    fs.writeFileSync(outPath, pdf);
    try {
      shell.showItemInFolder(outPath);
    } catch {
      await shell.openPath(dir);
    }
    return { path: outPath, fileName, date: reportDate };
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try {
      fs.unlinkSync(tmpHtml);
    } catch {
      /* ignore */
    }
  }
}

function mimeFromFileName(fileName) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function removeMetaSidecar(file) {
  const metaFile = `${file}.meta.json`;
  if (fs.existsSync(metaFile)) {
    try {
      fs.unlinkSync(metaFile);
    } catch {
      /* ignore */
    }
  }
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait for short lock retry */
  }
}

function withDataLock(fn) {
  const lockPath = path.join(dataDir(), ".data.lock");
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeFileSync(fd, `${process.pid}:${Date.now()}`);
      } finally {
        fs.closeSync(fd);
      }
      try {
        return fn();
      } finally {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* ignore */
        }
      }
    } catch {
      // Stale lock older than 30s — clear it
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > 30000) fs.unlinkSync(lockPath);
      } catch {
        /* ignore */
      }
      if (Date.now() - started > 8000) {
        throw new Error("ShopDesk data is busy on another PC. Try again.");
      }
      sleepSync(120);
    }
  }
}

function customerDocsDir(clientName) {
  const folder = path.join(docsRoot(), sanitizeFolderName(clientName));
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

/** Relative id stored in app data, e.g. "Ramesh Kumar/rc_scan.pdf" */
function makeDocFileId(clientName, type, originalName) {
  const ext = path.extname(originalName || "");
  const base = path.basename(originalName || "file", ext);
  const fileName = sanitizeFileName(`${type || "doc"}_${base}${ext}`);
  return `${sanitizeFolderName(clientName)}/${fileName}`;
}

function resolveDocPath(fileId) {
  const parts = String(fileId || "")
    .split(/[/\\]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error("Missing file id");

  const root = docsRoot();
  const safeParts =
    parts.length === 1
      ? [sanitizeFileName(parts[0])]
      : [
          sanitizeFolderName(parts[0]),
          ...parts.slice(1, -1).map(sanitizeFolderName),
          sanitizeFileName(parts[parts.length - 1]),
        ];
  const full = path.resolve(root, ...safeParts);
  if (!full.startsWith(path.resolve(root))) {
    throw new Error("Invalid document path");
  }
  return full;
}

function legacyDocPath(fileId) {
  return path.join(localDataRoot(), "docs", path.basename(String(fileId || "")));
}

function walkFindFile(root, basename, depth = 0) {
  if (!root || !basename || depth > 4 || !fs.existsSync(root)) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && (entry.name === basename || entry.name.replace(/[^\w.-]+/g, "_") === basename)) {
      return full;
    }
    if (entry.isDirectory()) {
      const nested = walkFindFile(full, basename, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function documentSearchRoots() {
  return [...new Set([docsRoot(), path.join(localDataRoot(), "docs")])];
}

function findExistingDocPath(fileId) {
  const base = path.basename(String(fileId || "").replace(/\\/g, "/"));
  const candidates = [];
  try { candidates.push(resolveDocPath(fileId)); } catch { /* continue */ }
  for (const root of documentSearchRoots()) {
    candidates.push(path.join(root, base));
    candidates.push(path.join(root, sanitizeFileName(base)));
    candidates.push(path.join(root, "Unknown Customer", base));
    candidates.push(path.join(root, "Unknown Customer", sanitizeFileName(base)));
  }
  for (const file of candidates) {
    try {
      if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    } catch {
      /* continue */
    }
  }
  for (const root of documentSearchRoots()) {
    const found = walkFindFile(root, base);
    if (found) return found;
  }
  try {
    return resolveDocPath(fileId);
  } catch {
    return legacyDocPath(fileId);
  }
}

function copyDirFiles(src, dest) {
  if (!src || !dest || !fs.existsSync(src)) return 0;
  if (path.resolve(src) === path.resolve(dest)) return 0;
  let copied = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch {
    return 0;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied += copyDirFiles(from, to);
      continue;
    }
    if (!entry.isFile() || entry.name.endsWith(".meta.json") || entry.name.endsWith(".meta")) continue;
    if (fs.existsSync(to)) continue;
    try {
      fs.copyFileSync(from, to);
      copied += 1;
    } catch {
      /* ignore */
    }
  }
  return copied;
}

function listLocalDocuments(root = docsRoot(), prefix = "", files = []) {
  if (!root || !fs.existsSync(root)) return files;
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.endsWith(".meta.json") || entry.name.endsWith(".meta")) continue;
    const full = path.join(root, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      listLocalDocuments(full, rel, files);
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      const st = fs.statSync(full);
      files.push({ fileId: rel.replace(/\\/g, "/"), name: entry.name, size: st.size });
    } catch {
      /* skip */
    }
  }
  return files;
}

function recoverDocumentsIntoCustomerFolders(data) {
  let copied = copyDirFiles(path.join(localDataRoot(), "docs"), docsRoot());
  const programData = process.env.PROGRAMDATA
    ? path.join(process.env.PROGRAMDATA, "ShopDesk Office Server", "documents")
    : "";
  if (programData) copied += copyDirFiles(programData, docsRoot());
  for (const policy of data && Array.isArray(data.policies) ? data.policies : []) {
    const clientName = String(policy.clientName || "").trim();
    if (!clientName) continue;
    for (const doc of policy.documents || []) {
      if (!doc || !doc.fileId) continue;
      const source = findExistingDocPath(doc.fileId);
      if (!source || !fs.existsSync(source)) continue;
      let dest;
      try {
        dest = resolveDocPath(`${sanitizeFolderName(clientName)}/${path.basename(source)}`);
      } catch {
        continue;
      }
      if (path.resolve(source) === path.resolve(dest)) continue;
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(source, dest);
          copied += 1;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { copied };
}

function waitForServer(url, attempts = 90) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        left -= 1;
        if (left <= 0) {
          reject(
            new Error(
              lastServerError ||
                "ShopDesk UI server did not start. The offline package may be incomplete.",
            ),
          );
        } else {
          setTimeout(tick, 500);
        }
      });
    };
    tick();
  });
}

function startNextServer() {
  if (isDev) {
    // Dev: expect `next dev` already running via npm script, or start it.
    return Promise.resolve();
  }

  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverJs = path.join(standaloneDir, "server.js");
  const nextModule = path.join(standaloneDir, "node_modules", "next");
  if (!fs.existsSync(serverJs)) {
    return Promise.reject(
      new Error("Offline package missing. Rebuild with npm run desktop:dist"),
    );
  }
  if (!fs.existsSync(nextModule)) {
    return Promise.reject(
      new Error(
        "Offline package is missing Next.js runtime files (node_modules). Rebuild with npm run desktop:dist",
      ),
    );
  }

  lastServerError = "";
  nextProcess = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const capture = (chunk) => {
    const text = String(chunk || "").trim();
    if (!text) return;
    console.error("[shopdesk-server]", text);
    lastServerError = text.slice(0, 500);
  };
  nextProcess.stdout?.on("data", capture);
  nextProcess.stderr?.on("data", capture);
  nextProcess.on("exit", (code, signal) => {
    if (code && code !== 0) {
      lastServerError =
        lastServerError ||
        `Offline UI server exited (code ${code}${signal ? `, signal ${signal}` : ""})`;
    }
  });

  return waitForServer(`http://127.0.0.1:${PORT}`);
}

function officeNetworkInfo() {
  return {
    port: OFFICE_PORT,
    discoverPort: DISCOVER_PORT,
    addresses: lanAddresses(),
    urls: lanUrls(OFFICE_PORT),
  };
}

function runDetached(command, args) {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { windowsHide: true, stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

async function ensureOfficeFirewall() {
  if (process.platform !== "win32") return { opened: true, skipped: true };
  const exe = process.execPath;
  const hasRule = (name) => runDetached("netsh", ["advfirewall", "firewall", "show", "rule", `name=${name}`]);
  const addTcpProgram = await runDetached("netsh", [
    "advfirewall", "firewall", "add", "rule",
    "name=ShopDesk Office Server",
    "dir=in",
    "action=allow",
    "enable=yes",
    "profile=any",
    "protocol=TCP",
    `localport=${OFFICE_PORT}`,
    `program=${exe}`,
  ]);
  const addTcpPort = await runDetached("netsh", [
    "advfirewall", "firewall", "add", "rule",
    "name=ShopDesk Office Server Port",
    "dir=in",
    "action=allow",
    "enable=yes",
    "profile=any",
    "protocol=TCP",
    `localport=${OFFICE_PORT}`,
  ]);
  const addUdp = await runDetached("netsh", [
    "advfirewall", "firewall", "add", "rule",
    "name=ShopDesk Office Server Discovery",
    "dir=in",
    "action=allow",
    "enable=yes",
    "profile=any",
    "protocol=UDP",
    `localport=${DISCOVER_PORT}`,
  ]);
  const tcpOk = addTcpProgram || addTcpPort
    || await hasRule("ShopDesk Office Server")
    || await hasRule("ShopDesk Office Server Port");
  const udpOk = addUdp || await hasRule("ShopDesk Office Server Discovery");
  return { opened: Boolean(tcpOk && udpOk), skipped: false };
}

function probeOfficeServer(url, timeoutMs = 4000) {
  const address = normalizeOfficeServerUrl(url);
  if (!address) {
    return Promise.resolve({
      ok: false,
      error: "Enter an address like 192.168.1.50 or http://192.168.1.50:3457",
    });
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const req = http.get(`${address}/health`, { timeout: timeoutMs }, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
          if (body.length > 20000) req.destroy();
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode === 200 && json.ok === true) {
              finish({
                ok: true,
                url: address,
                urls: Array.isArray(json.urls) ? json.urls : lanUrls(OFFICE_PORT),
                port: json.port || OFFICE_PORT,
                version: json.version,
                docsPath: json.docsPath,
              });
              return;
            }
            finish({ ok: false, error: "Office Server did not respond correctly" });
          } catch {
            finish({ ok: false, error: "Office Server did not respond correctly" });
          }
        });
      });
      req.on("timeout", () => {
        req.destroy();
        finish({ ok: false, error: `Timed out reaching ${address}` });
      });
      req.on("error", (error) => {
        const code = error && error.code;
        if (isLoopbackOfficeUrl(address)) {
          finish({
            ok: false,
            error: "localhost only works on the main PC. On this laptop, type the Wi-Fi address shown on the main PC Admin page, for example http://192.168.1.50:3457.",
          });
          return;
        }
        if (code === "ECONNREFUSED") {
          finish({ ok: false, error: `Nothing is listening at ${address}. Start Office Server on the main PC and keep ShopDesk open.` });
          return;
        }
        if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
          finish({ ok: false, error: `Cannot resolve ${address}. Use the main PC Wi-Fi IP, for example http://192.168.1.50:3457.` });
          return;
        }
        finish({
          ok: false,
          error: `Cannot reach ${address}. Check the main PC address, that Office Server is running, and Windows Firewall on the main PC.`,
        });
      });
    } catch {
      finish({ ok: false, error: "That office address is not valid" });
    }
  });
}

function discoverByUdp(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const found = new Map();
    let socket;
    const finish = () => {
      try { if (socket) socket.close(); } catch { /* ignore */ }
      resolve([...found.values()]);
    };
    try {
      socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch {
      resolve([]);
      return;
    }
    socket.on("error", () => finish());
    socket.on("message", (message) => {
      const reply = decodeDiscoverReply(message);
      if (!reply) return;
      for (const url of reply.urls) found.set(url, { url, urls: reply.urls, port: reply.port });
    });
    socket.bind(0, () => {
      try { socket.setBroadcast(true); } catch { /* ignore */ }
      const probe = Buffer.from(DISCOVER_PROBE);
      for (const target of broadcastAddresses()) {
        try { socket.send(probe, DISCOVER_PORT, target); } catch { /* ignore */ }
      }
    });
    setTimeout(finish, timeoutMs);
  });
}

async function mapPool(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current], current);
    await next();
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

async function discoverByScan() {
  const prefixes = subnetPrefixes();
  const candidates = [];
  for (const prefix of prefixes) {
    for (let host = 1; host <= 254; host += 1) {
      candidates.push(`http://${prefix}.${host}:${OFFICE_PORT}`);
    }
  }
  const found = new Map();
  await mapPool(candidates, 32, async (url) => {
    const result = await probeOfficeServer(url, 800);
    if (result.ok) found.set(result.url || url, { url: result.url || url, urls: result.urls || [url], port: result.port || OFFICE_PORT });
  });
  return [...found.values()];
}

async function discoverOfficeServers() {
  const udp = await discoverByUdp(1600);
  if (udp.length) return udp;
  return discoverByScan();
}

function officeServerScript() {
  return isDev
    ? path.join(__dirname, "..", "server", "office-server.cjs")
    : path.join(process.resourcesPath, "app.asar.unpacked", "server", "office-server.cjs");
}

async function startOfficeServer() {
  let running = false;
  try {
    await waitForServer("http://127.0.0.1:3457/health", 1);
    running = true;
  } catch {
    // No existing server; start the bundled one on this main office computer.
  }
  if (running) {
    const health = await probeOfficeServer("http://127.0.0.1:3457", 1500);
    if (!health.ok || Number(health.version || 0) < 2) {
      if (officeServerProcess && !officeServerProcess.killed) {
        officeServerProcess.kill();
        officeServerProcess = null;
      }
      running = false;
    }
  }
  if (!running) {
    const script = officeServerScript();
    if (!fs.existsSync(script)) {
      throw new Error("Office Server files are missing. Reinstall ShopDesk.");
    }
    officeServerProcess = spawn(process.execPath, [script], {
      cwd: path.dirname(script),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        SHOPDESK_OFFICE_PORT: "3457",
        SHOPDESK_OFFICE_DOCS_DIR: docsRoot(),
        SHOPDESK_OFFICE_EXTRA_DOCS_DIRS: path.join(localDataRoot(), "docs"),
      },
      stdio: "ignore",
    });
    await waitForServer("http://127.0.0.1:3457/health", 30);
  }
  const firewall = await ensureOfficeFirewall();
  const network = officeNetworkInfo();
  return {
    running: true,
    started: !running,
    port: network.port,
    urls: network.urls,
    addresses: network.addresses,
    firewallOpened: firewall.opened,
    localUrl: "http://127.0.0.1:3457",
    docsPath: docsRoot(),
  };
}

function showErrorPage(win, message, detail) {
  win.loadURL(
    "data:text/html," +
      encodeURIComponent(
        `<!doctype html><html><body style="font-family:Segoe UI,sans-serif;padding:32px;max-width:640px">
          <h1>ShopDesk could not open</h1>
          <p>${message}</p>
          ${detail ? `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px">${detail}</pre>` : ""}
          <p>If this is the installed desktop app, reinstall the latest build from <code>npm run desktop:dist</code>.</p>
        </body></html>`,
      ),
  );
  win.show();
}

function appIconPath() {
  const candidates = [
    path.join(__dirname, "..", "resources", "icon.png"),
    path.join(process.resourcesPath, "icon.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow(startupError) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: true,
    title: "Insurance Desk — E26",
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = isDev
    ? process.env.SHOPDESK_DEV_URL || "http://127.0.0.1:3010"
    : `http://127.0.0.1:${PORT}`;

  win.center();
  win.show();
  win.focus();
  win.moveTop();
  if (process.platform === "darwin" && app.dock) app.dock.show();

  if (startupError) {
    showErrorPage(win, "The offline UI server failed to start.", String(startupError.message || startupError));
    return;
  }

  win.webContents.on("did-fail-load", (_e, code, desc, validatedURL) => {
    console.error("Failed to load", code, desc, validatedURL);
    showErrorPage(
      win,
      `${desc} (${code})`,
      `Tried: ${validatedURL}\n${lastServerError || ""}`.trim(),
    );
  });

  console.log("Loading", url);
  win.loadURL(url);
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    // Keep in-app blank/blob/data windows (print helpers). Only external http(s) leaves the app.
    if (
      !openUrl ||
      openUrl === "about:blank" ||
      openUrl.startsWith("blob:") ||
      openUrl.startsWith("data:")
    ) {
      return { action: "allow" };
    }
    if (openUrl.startsWith("http://") || openUrl.startsWith("https://")) {
      void shell.openExternal(openUrl);
    }
    return { action: "deny" };
  });
}

function registerIpc() {
  ipcMain.handle("shopdesk:getMode", () => ({
    offline: true,
    dataPath: dataDir(),
    docsPath: docsRoot(),
    reportsPath: reportsRoot(),
    filesPath: filesRoot(),
  }));

  ipcMain.handle("shopdesk:savePdfReport", async (_event, payload) => {
    const { html, kind, date } = payload || {};
    if (!html) throw new Error("Missing report HTML");
    return await savePdfFromHtml(String(html), { kind, date });
  });

  ipcMain.handle("shopdesk:openReportsFolder", async () => {
    await shell.openPath(reportsRoot());
    return true;
  });

  ipcMain.handle("shopdesk:loadData", () => {
    migrateLegacyDataIfNeeded();
    const file = dataFile();
    if (!fs.existsSync(file)) return null;
    try {
      return withDataLock(() => JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      return null;
    }
  });

  ipcMain.handle("shopdesk:recoverDocuments", (_event, data) => recoverDocumentsIntoCustomerFolders(data || {}));

  ipcMain.handle("shopdesk:saveData", (_event, data) => {
    migrateLegacyDataIfNeeded();
    withDataLock(() => {
      fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2), "utf8");
    });
    return true;
  });

  ipcMain.handle("shopdesk:saveDoc", (_event, payload) => {
    const { base64, mime, name, clientName, type, fileId: existingId } =
      payload || {};
    if (!base64) throw new Error("Missing file");
    const buffer = Buffer.from(base64, "base64");
    let fileId;
    if (existingId && String(existingId).includes("/")) {
      fileId = String(existingId);
    } else if (existingId) {
      fileId = String(existingId);
      if (clientName) {
        const namedId = makeDocFileId(clientName, type, name || existingId);
        const namedFile = resolveDocPath(namedId);
        fs.mkdirSync(path.dirname(namedFile), { recursive: true });
        fs.writeFileSync(namedFile, buffer);
        removeMetaSidecar(namedFile);
      }
    } else {
      fileId = makeDocFileId(clientName, type, name);
    }
    customerDocsDir(clientName);
    const file = resolveDocPath(fileId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    // Only keep the uploaded image/pdf — remove any old sidecar meta files
    removeMetaSidecar(file);
    return {
      fileId,
      size: buffer.length,
      path: file,
      mime: mime || mimeFromFileName(name || file),
    };
  });

  ipcMain.handle("shopdesk:readDoc", (_event, fileId) => {
    const file = findExistingDocPath(fileId);
    if (!fs.existsSync(file)) return null;
    const buffer = fs.readFileSync(file);
    let mime = mimeFromFileName(file);
    let name = path.basename(file);
    const metaFile = `${file}.meta.json`;
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
        mime = meta.mime || mime;
        name = meta.name || name;
      } catch {
        /* ignore */
      }
      // Clean leftover meta files from older builds
      removeMetaSidecar(file);
    }
    return {
      fileId,
      name,
      mime,
      dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    };
  });

  ipcMain.handle("shopdesk:deleteDoc", (_event, fileId) => {
    const file = findExistingDocPath(fileId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    removeMetaSidecar(file);
    return true;
  });

  ipcMain.handle("shopdesk:listDocs", () => listLocalDocuments());
  ipcMain.handle("shopdesk:docStat", (_event, fileId) => {
    try {
      const file = findExistingDocPath(fileId);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
      return { fileId, size: fs.statSync(file).size, path: file };
    } catch {
      return null;
    }
  });

  ipcMain.handle("shopdesk:openDataFolder", async () => {
    await shell.openPath(docsRoot());
    return true;
  });

  ipcMain.handle("shopdesk:print", (event) =>
    new Promise((resolve, reject) => {
      event.sender.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (success) resolve(true);
          else reject(new Error(failureReason || "Print cancelled or failed"));
        },
      );
    }),
  );

  ipcMain.handle("shopdesk:startOfficeServer", () => startOfficeServer());
  ipcMain.handle("shopdesk:getOfficeLanInfo", () => officeNetworkInfo());
  ipcMain.handle("shopdesk:probeOfficeServer", (_event, url) => probeOfficeServer(url));
  ipcMain.handle("shopdesk:discoverOfficeServers", () => discoverOfficeServers());

  ipcMain.handle("shopdesk:getLicenseStatus", async () => {
    return getLicenseStatus(dataDir());
  });

  ipcMain.handle("shopdesk:activateLicense", async (_event, licenseKey) => {
    return activateLicenseRemote(dataDir(), String(licenseKey || ""));
  });

  ipcMain.handle("shopdesk:refreshLicense", async () => {
    return refreshLicense(dataDir());
  });
}

app.whenReady().then(async () => {
  app.setName("ShopDesk");
  migrateLegacyDataIfNeeded();
  try {
    deleteMetaSidecars(docsRoot());
    deleteMetaSidecars(reportsRoot());
  } catch {
    /* ignore */
  }
  registerIpc();

  // Background license refresh when online (non-blocking)
  if (!isDev) {
    void refreshLicense(dataDir()).catch(() => {
      /* offline is fine */
    });
  }

  let startupError = null;
  try {
    if (!isDev) await startNextServer();
    else await waitForServer(process.env.SHOPDESK_DEV_URL || "http://127.0.0.1:3010", 80);
  } catch (err) {
    console.error(err);
    startupError = err;
  }
  createWindow(startupError);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(startupError);
  });
});

app.on("window-all-closed", () => {
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
  if (officeServerProcess && !officeServerProcess.killed) officeServerProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
  if (officeServerProcess && !officeServerProcess.killed) officeServerProcess.kill();
});
