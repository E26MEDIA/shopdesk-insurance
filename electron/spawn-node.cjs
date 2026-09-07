"use strict";

const path = require("path");
const { spawn } = require("child_process");

function stringEnv(extra = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries({ ...process.env, ...extra })) {
    if (value == null) continue;
    out[key] = String(value);
  }
  return out;
}

/**
 * Run a Node script by launching Electron as Node.
 * The packaged Next.js UI server and Office Server need a real Node process;
 * utilityProcess cannot boot that standalone server once runAsNode is disabled.
 * @param {typeof import("electron")} _electronApi
 * @param {string} scriptPath
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, stdio?: "pipe" | "ignore", serviceName?: string, args?: string[] }} [options]
 */
function spawnNodeScript(_electronApi, scriptPath, options = {}) {
  const abs = path.resolve(scriptPath);
  const env = stringEnv(options.env || {});
  env.ELECTRON_RUN_AS_NODE = "1";
  return spawn(process.execPath, [abs, ...(options.args || [])], {
    cwd: options.cwd || path.dirname(abs),
    env,
    stdio: options.stdio === "pipe" ? ["ignore", "pipe", "pipe"] : "ignore",
    windowsHide: true,
  });
}

module.exports = {
  stringEnv,
  spawnNodeScript,
};
