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

function dataDir() {
  const dir = path.join(app.getPath("userData"), "shopdesk-data");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  return dir;
}

function dataFile() {
  return path.join(dataDir(), "data.json");
}

function docPath(fileId) {
  return path.join(dataDir(), "docs", fileId);
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
    shell.openExternal(openUrl);
    return { action: "deny" };
  });
}

function registerIpc() {
  ipcMain.handle("shopdesk:getMode", () => ({
    offline: true,
    dataPath: dataDir(),
  }));

  ipcMain.handle("shopdesk:loadData", () => {
    const file = dataFile();
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  });

  ipcMain.handle("shopdesk:saveData", (_event, data) => {
    fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2), "utf8");
    return true;
  });

  ipcMain.handle("shopdesk:saveDoc", (_event, payload) => {
    const { fileId, base64, mime, name } = payload || {};
    if (!fileId || !base64) throw new Error("Missing file");
    const buffer = Buffer.from(base64, "base64");
    const meta = { mime: mime || "application/octet-stream", name: name || fileId };
    fs.writeFileSync(docPath(fileId), buffer);
    fs.writeFileSync(`${docPath(fileId)}.meta.json`, JSON.stringify(meta));
    return { fileId, size: buffer.length };
  });

  ipcMain.handle("shopdesk:readDoc", (_event, fileId) => {
    const file = docPath(fileId);
    if (!fs.existsSync(file)) return null;
    const buffer = fs.readFileSync(file);
    let mime = "application/octet-stream";
    let name = fileId;
    const metaFile = `${file}.meta.json`;
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
        mime = meta.mime || mime;
        name = meta.name || name;
      } catch {
        /* ignore */
      }
    }
    return {
      fileId,
      name,
      mime,
      dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    };
  });

  ipcMain.handle("shopdesk:deleteDoc", (_event, fileId) => {
    const file = docPath(fileId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    const metaFile = `${file}.meta.json`;
    if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
    return true;
  });

  ipcMain.handle("shopdesk:openDataFolder", async () => {
    await shell.openPath(dataDir());
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
