const fs = require("fs");
const path = require("path");

function licenseDir(dataRoot) {
  const dir = path.join(dataRoot, "license");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function tokenPath(dataRoot) {
  return path.join(licenseDir(dataRoot), "activation.jwt");
}

function statePath(dataRoot) {
  return path.join(licenseDir(dataRoot), "state.json");
}

function saveLicenseState(dataRoot, state) {
  fs.writeFileSync(statePath(dataRoot), JSON.stringify(state, null, 2), "utf8");
}

function loadLicenseState(dataRoot) {
  const file = statePath(dataRoot);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveToken(dataRoot, token) {
  fs.writeFileSync(tokenPath(dataRoot), token, "utf8");
}

function loadToken(dataRoot) {
  const file = tokenPath(dataRoot);
  if (!fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
}

function pendingKeyPath(dataRoot) {
  return path.join(dataRoot, "license", "pending-key.txt");
}

function savePendingKey(dataRoot, key) {
  fs.mkdirSync(path.dirname(pendingKeyPath(dataRoot)), { recursive: true });
  fs.writeFileSync(pendingKeyPath(dataRoot), String(key || "").trim(), "utf8");
}

function loadPendingKey(dataRoot) {
  const file = pendingKeyPath(dataRoot);
  if (!fs.existsSync(file)) return "";
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

function clearPendingKey(dataRoot) {
  const file = pendingKeyPath(dataRoot);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

/**
 * Find a verification key saved by the Windows installer, including older
 * AppData folder names if Electron's userData path does not match.
 */
function findPendingKey(dataRoot, extraRoots = []) {
  const seen = new Set();
  const roots = [dataRoot, ...extraRoots].filter(Boolean);
  for (const root of roots) {
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const key = loadPendingKey(root);
    if (key) return { key, root };
  }
  return { key: "", root: null };
}

module.exports = {
  saveLicenseState,
  loadLicenseState,
  saveToken,
  loadToken,
  pendingKeyPath,
  savePendingKey,
  loadPendingKey,
  clearPendingKey,
  findPendingKey,
};
