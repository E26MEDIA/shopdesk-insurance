/*
 * ShopDesk Office Server (Phase 1)
 *
 * Run this only on the main office PC. It keeps a single SQLite database on
 * that PC and is designed for the three computers on the same Wi-Fi network.
 */
const http = require("http");
const dgram = require("dgram");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const {
  DISCOVER_PORT,
  DISCOVER_PROBE,
  lanUrls,
  corsHeaders,
  encodeDiscoverReply,
  safeDocumentRelPath,
  isInsideDir,
} = require("./office-network.cjs");

const PORT = Number(process.env.SHOPDESK_OFFICE_PORT || 3457);
const HOST = process.env.SHOPDESK_OFFICE_HOST || "0.0.0.0";
const BACKUP_HOUR = Number(process.env.SHOPDESK_BACKUP_HOUR || 20);
const BACKUP_RETENTION_DAYS = Number(process.env.SHOPDESK_BACKUP_RETENTION_DAYS || 30);
const baseDir = process.env.SHOPDESK_OFFICE_DATA_DIR || path.join(
  process.env.PROGRAMDATA || path.join(os.homedir(), ".shopdesk"),
  "ShopDesk Office Server",
);
const backupsDir = path.join(baseDir, "backups");
const bundledDocumentsDir = path.join(baseDir, "documents");
const documentsDir = resolveDocumentsDir();
const extraDocumentDirs = resolveExtraDocumentDirs();
const databasePath = path.join(baseDir, "shopdesk.sqlite");

function resolveDocumentsDir() {
  if (process.env.SHOPDESK_OFFICE_DOCS_DIR) {
    fs.mkdirSync(process.env.SHOPDESK_OFFICE_DOCS_DIR, { recursive: true });
    return process.env.SHOPDESK_OFFICE_DOCS_DIR;
  }
  if (process.platform === "win32") {
    const eDrive = path.join("E:", "insurance desk", "docs");
    try {
      fs.mkdirSync(eDrive, { recursive: true });
      fs.accessSync(eDrive, fs.constants.W_OK);
      return eDrive;
    } catch {
      /* fall through */
    }
  }
  fs.mkdirSync(bundledDocumentsDir, { recursive: true });
  return bundledDocumentsDir;
}

function resolveExtraDocumentDirs() {
  const dirs = [bundledDocumentsDir];
  for (const extra of String(process.env.SHOPDESK_OFFICE_EXTRA_DOCS_DIRS || "").split(path.delimiter)) {
    if (extra) dirs.push(extra);
  }
  if (process.platform === "win32") {
    const eDrive = path.join("E:", "insurance desk", "docs");
    if (fs.existsSync(eDrive)) dirs.push(eDrive);
  }
  return [...new Set(dirs.map((dir) => path.resolve(dir)))];
}

fs.mkdirSync(backupsDir, { recursive: true });
fs.mkdirSync(documentsDir, { recursive: true });
let db = new DatabaseSync(databasePath);
const startedAt = new Date().toISOString();
const connectedClients = new Map();
function initializeDatabase() {
  db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS office_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    computer TEXT NOT NULL,
    summary TEXT NOT NULL
  );
`);
}
initializeDatabase();

const emptyData = {
  clients: [], vehicles: [], policies: [], pucEntries: [], expenses: [],
  adjustments: [], masters: {}, formFields: [],
};
const initial = db.prepare("SELECT id FROM app_state WHERE id = 1").get();
if (!initial) {
  db.prepare("INSERT INTO app_state (id, revision, updated_at, payload) VALUES (1, 0, ?, ?)")
    .run(new Date().toISOString(), JSON.stringify(emptyData));
}

function readState() {
  const row = db.prepare("SELECT revision, updated_at, payload FROM app_state WHERE id = 1").get();
  return { revision: row.revision, updatedAt: row.updated_at, data: JSON.parse(row.payload) };
}

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(JSON.stringify(value));
}

function advertisedUrls() {
  return lanUrls(PORT);
}

function readJson(req, maximumBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maximumBytes) {
        reject(new Error("Request is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
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

function walkFindByBasename(root, basename, depth = 0) {
  if (!root || !basename || depth > 4 || !fs.existsSync(root)) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && entry.name === basename) return full;
    if (entry.isDirectory()) {
      const nested = walkFindByBasename(full, basename, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function documentSearchRoots() {
  return [...new Set([path.resolve(documentsDir), ...extraDocumentDirs])];
}

function findDocumentFile(id) {
  const rel = safeDocumentRelPath(id);
  if (!rel) return null;
  const base = path.basename(rel);
  const candidates = [];
  for (const root of documentSearchRoots()) {
    candidates.push(path.join(root, ...rel.split("/")));
    candidates.push(path.join(root, base));
    candidates.push(path.join(root, "Unknown Customer", base));
  }
  for (const file of candidates) {
    const root = documentSearchRoots().find((dir) => isInsideDir(dir, file));
    if (root && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  for (const root of documentSearchRoots()) {
    const found = walkFindByBasename(root, base);
    if (found && isInsideDir(root, found)) return found;
  }
  return null;
}

function writeDocumentPath(id) {
  const rel = safeDocumentRelPath(id);
  if (!rel) return null;
  const file = path.join(documentsDir, ...rel.split("/"));
  if (!isInsideDir(documentsDir, file)) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

function createBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(backupsDir, `shopdesk-${stamp}.sqlite`);
  const documentsBackup = path.join(backupsDir, `shopdesk-${stamp}-documents`);
  // SQLite WAL checkpoints first, ensuring the backup includes the newest save.
  db.exec("PRAGMA wal_checkpoint(FULL)");
  fs.copyFileSync(databasePath, destination);
  fs.cpSync(documentsDir, documentsBackup, { recursive: true });
  pruneBackups();
  return { database: path.basename(destination), documents: path.basename(documentsBackup) };
}

function restoreBackup(file, pin) {
  const selected = listBackups().find((backup) => backup.file === file);
  if (!selected) throw new Error("Backup was not found");
  if (!configuredPinHash() || pinHash(pin) !== configuredPinHash()) {
    const error = new Error("Admin PIN is incorrect");
    error.status = 403;
    throw error;
  }
  const source = path.join(backupsDir, selected.file);
  const sourceDocuments = path.join(backupsDir, selected.file.replace(/\.sqlite$/, "-documents"));
  if (!fs.existsSync(sourceDocuments)) throw new Error("The documents backup is missing");
  // Always preserve the exact current state first, even if the wrong backup was chosen.
  const safetyBackup = createBackup();
  db.close();
  fs.copyFileSync(source, databasePath);
  fs.rmSync(documentsDir, { recursive: true, force: true });
  fs.cpSync(sourceDocuments, documentsDir, { recursive: true });
  db = new DatabaseSync(databasePath);
  initializeDatabase();
  db.prepare("INSERT INTO activity_log (created_at, computer, summary) VALUES (?, ?, ?)")
    .run(new Date().toISOString(), "Admin restore", `Restored backup ${selected.file}`);
  return { restored: selected.file, safetyBackup: safetyBackup.database };
}

function pinHash(pin) {
  return crypto.createHash("sha256").update(String(pin)).digest("hex");
}

function configuredPinHash() {
  return db.prepare("SELECT value FROM office_settings WHERE key = 'admin_pin_hash'").get()?.value || null;
}

function configuredAccessKeyHash() {
  return db.prepare("SELECT value FROM office_settings WHERE key = 'office_access_key_hash'").get()?.value || null;
}

function validAccessKey(req) {
  const expected = configuredAccessKeyHash();
  if (!expected) return true;
  const supplied = String(req.headers["x-shopdesk-office-key"] || "");
  return supplied.length > 0 && crypto.timingSafeEqual(Buffer.from(pinHash(supplied)), Buffer.from(expected));
}

function activitySummary(before, after) {
  const groups = [
    ["clients", "client"], ["vehicles", "vehicle"], ["policies", "policy"],
    ["pucEntries", "PUC entry"], ["expenses", "expense"], ["adjustments", "adjustment"],
  ];
  const summary = [];
  for (const [key, label] of groups) {
    const previous = new Map((before[key] || []).map((item) => [item.id, JSON.stringify(item)]));
    const next = new Map((after[key] || []).map((item) => [item.id, JSON.stringify(item)]));
    let added = 0; let removed = 0; let changed = 0;
    for (const [id, value] of next) {
      if (!previous.has(id)) added += 1;
      else if (previous.get(id) !== value) changed += 1;
    }
    for (const id of previous.keys()) if (!next.has(id)) removed += 1;
    if (added) summary.push(`${added} ${label}${added === 1 ? "" : "s"} added`);
    if (changed) summary.push(`${changed} ${label}${changed === 1 ? "" : "s"} updated`);
    if (removed) summary.push(`${removed} ${label}${removed === 1 ? "" : "s"} removed`);
  }
  if (JSON.stringify(before.masters) !== JSON.stringify(after.masters) || JSON.stringify(before.formFields) !== JSON.stringify(after.formFields)) {
    summary.push("Admin settings updated");
  }
  return summary.join(" · ") || "Shared data updated";
}

function activeClients() {
  const cutoff = Date.now() - 35000;
  for (const [id, client] of connectedClients) {
    if (client.lastSeen < cutoff) connectedClients.delete(id);
  }
  return [...connectedClients.entries()].map(([id, client]) => ({
    id,
    label: client.label,
    lastSeen: new Date(client.lastSeen).toISOString(),
  }));
}

function listBackups() {
  return fs.readdirSync(backupsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^shopdesk-.*\.sqlite$/.test(entry.name))
    .map((entry) => ({
      file: entry.name,
      createdAt: fs.statSync(path.join(backupsDir, entry.name)).mtime.toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function pruneBackups() {
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 86400000;
  for (const entry of fs.readdirSync(backupsDir, { withFileTypes: true })) {
    const fullPath = path.join(backupsDir, entry.name);
    if (!entry.name.startsWith("shopdesk-") || fs.statSync(fullPath).mtimeMs >= cutoff) continue;
    if (entry.isDirectory()) fs.rmSync(fullPath, { recursive: true, force: true });
    else fs.unlinkSync(fullPath);
  }
}

let backupTimer = null;
function scheduleDailyBackup() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  backupTimer = setTimeout(() => {
    try {
      const backup = createBackup();
      console.log("Daily backup created", backup.database);
    } catch (error) {
      console.error("Daily backup failed", error);
    }
    scheduleDailyBackup();
  }, delay);
  console.log(`Daily backup scheduled for ${next.toLocaleString()}.`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") return json(res, 204, {});

  try {
    if (url.pathname !== "/health" && url.pathname !== "/api/v1/access-key" && !validAccessKey(req)) {
      return json(res, 401, { error: "Office Access Key is required" });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        service: "shopdesk-office-server",
        version: 2,
        port: PORT,
        urls: advertisedUrls(),
        dataPath: databasePath,
        docsPath: documentsDir,
      });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/status") {
      return json(res, 200, {
        ok: true, startedAt, port: PORT, backupHour: BACKUP_HOUR,
        urls: advertisedUrls(),
        clients: activeClients(), latestBackup: listBackups()[0] || null,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/clients/heartbeat") {
      const input = await readJson(req);
      const id = String(input.id || "");
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return json(res, 400, { error: "Invalid computer id" });
      connectedClients.set(id, {
        label: String(input.label || "ShopDesk computer").slice(0, 80),
        lastSeen: Date.now(),
      });
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/activity") {
      const requested = Number(url.searchParams.get("limit") || 20);
      const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 20;
      const entries = db.prepare("SELECT id, created_at, computer, summary FROM activity_log ORDER BY id DESC LIMIT ?").all(limit)
        .map((entry) => ({ id: entry.id, createdAt: entry.created_at, computer: entry.computer, summary: entry.summary }));
      return json(res, 200, { entries });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/data") {
      return json(res, 200, readState());
    }
    if (req.method === "PUT" && url.pathname === "/api/v1/data") {
      const input = await readJson(req);
      if (!input || typeof input.data !== "object" || Array.isArray(input.data)) {
        return json(res, 400, { error: "Expected a data object" });
      }
      const expected = Number(req.headers["if-match"]);
      const current = readState();
      if (!Number.isInteger(expected) || expected !== current.revision) {
        return json(res, 409, { error: "Data changed on another computer", currentRevision: current.revision });
      }
      const updatedAt = new Date().toISOString();
      const revision = current.revision + 1;
      const computer = String(req.headers["x-shopdesk-label"] || req.headers["x-shopdesk-device"] || "ShopDesk computer").slice(0, 80);
      const summary = activitySummary(current.data, input.data);
      db.prepare("UPDATE app_state SET revision = ?, updated_at = ?, payload = ? WHERE id = 1")
        .run(revision, updatedAt, JSON.stringify(input.data));
      db.prepare("INSERT INTO activity_log (created_at, computer, summary) VALUES (?, ?, ?)")
        .run(updatedAt, computer, summary);
      return json(res, 200, { revision, updatedAt });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/backups") {
      return json(res, 201, createBackup());
    }
    if (req.method === "GET" && url.pathname === "/api/v1/backups") {
      return json(res, 200, { backups: listBackups() });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/backups/restore") {
      const input = await readJson(req);
      try {
        return json(res, 200, restoreBackup(String(input.file || ""), String(input.pin || "")));
      } catch (error) {
        return json(res, error && error.status === 403 ? 403 : 400, { error: error instanceof Error ? error.message : "Restore failed" });
      }
    }
    if (req.method === "GET" && url.pathname === "/api/v1/admin-pin") {
      return json(res, 200, { configured: Boolean(configuredPinHash()) });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/admin-pin") {
      const input = await readJson(req);
      const existing = configuredPinHash();
      if (input.action === "verify") {
        return json(res, 200, { valid: Boolean(existing && pinHash(input.pin) === existing) });
      }
      if (input.action === "set") {
        const pin = String(input.pin || "");
        if (!/^\d{4,12}$/.test(pin)) return json(res, 400, { error: "PIN must be 4 to 12 digits" });
        if (existing && pinHash(input.currentPin) !== existing) {
          return json(res, 403, { error: "Current Admin PIN is incorrect" });
        }
        db.prepare("INSERT OR REPLACE INTO office_settings (key, value) VALUES ('admin_pin_hash', ?)").run(pinHash(pin));
        return json(res, 200, { configured: true });
      }
      return json(res, 400, { error: "Unknown Admin PIN action" });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/access-key") {
      return json(res, 200, { configured: Boolean(configuredAccessKeyHash()) });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/access-key") {
      const input = await readJson(req);
      const key = String(input.key || "");
      if (input.action !== "set" || key.length < 20 || key.length > 200) {
        return json(res, 400, { error: "Access Key must be 20 to 200 characters" });
      }
      const pin = configuredPinHash();
      if (!pin || pinHash(input.pin) !== pin) return json(res, 403, { error: "Admin PIN is required" });
      db.prepare("INSERT OR REPLACE INTO office_settings (key, value) VALUES ('office_access_key_hash', ?)").run(pinHash(key));
      return json(res, 200, { configured: true });
    }
    if (url.pathname.startsWith("/api/v1/documents/")) {
      const fileId = decodeURIComponent(url.pathname.slice("/api/v1/documents/".length));
      if (req.method === "GET") {
        const file = findDocumentFile(fileId);
        if (!file) return json(res, 404, { error: "Document not found" });
        const metaFile = `${file}.meta.json`;
        let name = path.basename(file);
        let mime = mimeFromFileName(file);
        if (fs.existsSync(metaFile)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metaFile, "utf8"));
            name = metadata.name || name;
            mime = metadata.mime || mime;
          } catch { /* ignore */ }
        }
        return json(res, 200, {
          fileId,
          name,
          mime,
          base64: fs.readFileSync(file).toString("base64"),
        });
      }
      if (req.method === "PUT") {
        const file = writeDocumentPath(fileId);
        if (!file) return json(res, 400, { error: "Invalid document id" });
        const input = await readJson(req, 40 * 1024 * 1024);
        if (!input.base64 || typeof input.base64 !== "string") {
          return json(res, 400, { error: "Missing document data" });
        }
        const bytes = Buffer.from(input.base64, "base64");
        if (!bytes.length || bytes.length > 25 * 1024 * 1024) {
          return json(res, 400, { error: "Document must be between 1 byte and 25 MB" });
        }
        fs.writeFileSync(file, bytes);
        return json(res, 201, { fileId, size: bytes.length, path: file });
      }
      if (req.method === "DELETE") {
        const file = findDocumentFile(fileId) || writeDocumentPath(fileId);
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
        const metaFile = file ? `${file}.meta.json` : "";
        if (metaFile && fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
        return json(res, 200, { deleted: true });
      }
    }
    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("Office server request failed", error);
    return json(res, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
});

function startDiscoverResponder() {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  socket.on("error", (error) => {
    console.warn("Office server discovery is unavailable", error.message || error);
  });
  socket.on("message", (message, remote) => {
    if (String(message) !== DISCOVER_PROBE) return;
    const reply = encodeDiscoverReply({
      ok: true,
      port: PORT,
      urls: advertisedUrls(),
      startedAt,
    });
    socket.send(reply, remote.port, remote.address, () => undefined);
  });
  socket.bind(DISCOVER_PORT, HOST, () => {
    try { socket.setBroadcast(true); } catch { /* ignore */ }
  });
  return socket;
}

const discoverSocket = startDiscoverResponder();

server.listen(PORT, HOST, () => {
  console.log(`ShopDesk Office Server is running on port ${PORT}.`);
  console.log(`Database: ${databasePath}`);
  const urls = advertisedUrls();
  if (urls.length) {
    console.log("Other office computers should connect to:");
    for (const url of urls) console.log(`  ${url}`);
  } else {
    console.log("No Wi-Fi/Ethernet address found. Connect this PC to the office network.");
  }
  console.log(`Documents folder: ${documentsDir}`);
  console.log("Keep this window open while the office is working.");
  scheduleDailyBackup();
});

function close() {
  if (backupTimer) clearTimeout(backupTimer);
  try { discoverSocket.close(); } catch { /* ignore */ }
  server.close(() => {
    try { db.close(); } catch { /* ignore */ }
  });
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
