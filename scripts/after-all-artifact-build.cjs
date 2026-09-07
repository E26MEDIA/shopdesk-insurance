"use strict";

const path = require("path");
const { zipSingleFile } = require("./zip-stored-file.cjs");

/**
 * electron-builder hook: wrap each NSIS installer in a .zip for Dropbox/Chrome.
 * @param {{ artifactPaths?: string[] }} buildResult
 * @returns {string[]}
 */
function afterAllArtifactBuild(buildResult) {
  const extra = [];
  for (const artifact of buildResult.artifactPaths || []) {
    if (!/\.exe$/i.test(artifact)) continue;
    if (!/Setup/i.test(path.basename(artifact))) continue;
    const zipPath = `${artifact}.zip`;
    zipSingleFile(artifact, zipPath, path.basename(artifact));
    extra.push(zipPath);
  }
  return extra;
}

module.exports = afterAllArtifactBuild;
module.exports.afterAllArtifactBuild = afterAllArtifactBuild;
module.exports.default = afterAllArtifactBuild;
