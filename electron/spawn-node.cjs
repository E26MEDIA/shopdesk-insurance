"use strict";

const path = require("path");

function stringEnv(extra = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries({ ...process.env, ...extra })) {
    if (value == null) continue;
    out[key] = String(value);
  }
  // Packaged builds disable the runAsNode fuse. Never relaunch Electron as Node.
  delete out.ELECTRON_RUN_AS_NODE;
  return out;
}

function markKillable(child) {
  if (!child) return child;
  let killed = Boolean(child.killed);
  const originalKill = typeof child.kill === "function" ? child.kill.bind(child) : () => false;
  Object.defineProperty(child, "killed", {
    configurable: true,
    enumerable: true,
    get() {
      return killed;
    },
    set(value) {
      killed = Boolean(value);
    },
  });
  child.kill = (...args) => {
    killed = true;
    return originalKill(...args);
  };
  if (typeof child.on === "function") {
    child.on("exit", () => {
      killed = true;
    });
  }
  return child;
}

/**
 * Run a Node script in an Electron Utility Process (works with runAsNode disabled).
 * @param {typeof import("electron")} electronApi
 * @param {string} scriptPath
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, stdio?: "pipe" | "ignore", serviceName?: string, args?: string[] }} [options]
 */
function spawnNodeScript(electronApi, scriptPath, options = {}) {
  const abs = path.resolve(scriptPath);
  const utilityProcess = electronApi && electronApi.utilityProcess;
  if (!utilityProcess || typeof utilityProcess.fork !== "function") {
    throw new Error(
      "Electron utilityProcess is required to start Insurance Desk services. Rebuild the desktop app.",
    );
  }
  const child = utilityProcess.fork(abs, options.args || [], {
    cwd: options.cwd || path.dirname(abs),
    env: stringEnv(options.env || {}),
    stdio: options.stdio === "pipe" ? "pipe" : "ignore",
    serviceName: options.serviceName || "Insurance Desk",
  });
  return markKillable(child);
}

module.exports = {
  stringEnv,
  spawnNodeScript,
};
