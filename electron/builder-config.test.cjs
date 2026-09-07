const { test } = require("node:test");
const assert = require("node:assert/strict");
const pkg = require("../package.json");
const { validateSchema } = require("app-builder-lib/out/util/config/schemaValidator");
const schema = require("app-builder-lib/scheme.json");

test("Windows builder uses a wizard installer instead of one-click NSIS", () => {
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(pkg.build.nsis.packElevateHelper, false);
  assert.equal(pkg.build.nsis.allowElevation, false);
});

test("Windows builder publishes E26 Media identity and keeps Node spawn working", () => {
  assert.equal(pkg.build.win.signtoolOptions.publisherName, "E26 Media");
  assert.equal(pkg.build.win.requestedExecutionLevel, "asInvoker");
  assert.equal(pkg.author.name, "E26 Media");
  assert.equal(pkg.build.electronFuses.runAsNode, true);
  assert.equal(pkg.build.electronFuses.enableNodeCliInspectArguments, false);
  assert.equal(pkg.build.electronFuses.onlyLoadAppFromAsar, true);
  assert.equal(pkg.build.afterAllArtifactBuild, "./scripts/after-all-artifact-build.cjs");
  assert.equal(pkg.build.win.artifactName, "ShopDesk-Setup-${version}.${ext}");
});

test("electron-builder schema accepts the package.json build config", () => {
  validateSchema(schema, pkg.build, { name: "electron-builder" });
});
