const { test } = require("node:test");
const assert = require("node:assert/strict");
const pkg = require("../package.json");

test("Windows builder uses a wizard installer instead of one-click NSIS", () => {
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(pkg.build.nsis.packElevateHelper, false);
  assert.equal(pkg.build.nsis.allowElevation, false);
});

test("Windows builder publishes E26 Media identity and fuses runAsNode off", () => {
  assert.equal(pkg.build.win.publisherName, "E26 Media");
  assert.equal(pkg.build.win.requestedExecutionLevel, "asInvoker");
  assert.equal(pkg.build.electronFuses.runAsNode, false);
  assert.equal(pkg.build.electronFuses.enableNodeCliInspectArguments, false);
  assert.equal(pkg.build.electronFuses.onlyLoadAppFromAsar, true);
  assert.equal(pkg.build.afterAllArtifactBuild, "./scripts/after-all-artifact-build.cjs");
  assert.equal(pkg.build.win.artifactName, "ShopDesk-Setup-${version}.${ext}");
});
