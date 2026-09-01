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

module.exports = {
  saveLicenseState,
  loadLicenseState,
  saveToken,
  loadToken,
};
