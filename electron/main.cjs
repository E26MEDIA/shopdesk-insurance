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
const { spawn } = require("child_process");

const PORT = Number(process.env.SHOPDESK_PORT || 3456);
const isDev = !app.isPackaged;

/** @type {import('child_process').ChildProcess | null} */
let nextProcess = null;
/** @type {string} */
let lastServerError = "";

const PREFERRED_SHARED_ROOT =
  process.env.SHOPDESK_SHARED_ROOT || "E:\\insurance desk";

/** @type {string | null} */
let cachedSharedRoot = null;
/** @type {string | null} */
let cachedDocsRoot = null;

function localFallbackRoot() {
  const dir = path.join(app.getPath("userData"), "shopdesk-data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sharedRoot() {
  if (cachedSharedRoot) return cachedSharedRoot;
  try {
    fs.mkdirSync(PREFERRED_SHARED_ROOT, { recursive: true });
    fs.accessSync(PREFERRED_SHARED_ROOT, fs.constants.W_OK);
    cachedSharedRoot = PREFERRED_SHARED_ROOT;
  } catch {
    cachedSharedRoot = localFallbackRoot();
  }
  return cachedSharedRoot;
}

function dataDir() {
  const dir = sharedRoot();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dataFile() {
  return path.join(dataDir(), "data.json");
}

function legacyLocalDataFile() {
  return path.join(app.getPath("userData"), "shopdesk-data", "data.json");
}

function migrateLegacyDataIfNeeded() {
  const shared = dataFile();
  if (fs.existsSync(shared)) return;
  const legacy = legacyLocalDataFile();
  if (!fs.existsSync(legacy)) return;
  try {
    fs.copyFileSync(legacy, shared);
  } catch {
    /* ignore */
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
  const preferred = path.join(sharedRoot(), "docs");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    cachedDocsRoot = preferred;
  } catch {
    const fallback = path.join(localFallbackRoot(), "docs");
    fs.mkdirSync(fallback, { recursive: true });
    cachedDocsRoot = fallback;
  }
  return cachedDocsRoot;
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
  return path.join(localFallbackRoot(), "docs", path.basename(String(fileId || "")));
}

function findExistingDocPath(fileId) {
  try {
    const next = resolveDocPath(fileId);
    if (fs.existsSync(next)) return next;
  } catch {
    /* continue */
  }
  const legacy = legacyDocPath(fileId);
  if (fs.existsSync(legacy)) return legacy;
  try {
    return resolveDocPath(fileId);
  } catch {
    return legacy;
  }
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

function createWindow(startupError) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: true,
    title: "ShopDesk — Offline",
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
    shared: dataDir() === PREFERRED_SHARED_ROOT || dataDir().startsWith(PREFERRED_SHARED_ROOT),
  }));

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
    const fileId =
      existingId && String(existingId).includes("/")
        ? String(existingId)
        : makeDocFileId(clientName, type, name);
    customerDocsDir(clientName);
    const file = resolveDocPath(fileId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const buffer = Buffer.from(base64, "base64");
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

  ipcMain.handle("shopdesk:openDataFolder", async () => {
    await shell.openPath(docsRoot());
    return true;
  });
}

app.whenReady().then(async () => {
  app.setName("ShopDesk");
  registerIpc();
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
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
});
