const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stringEnv } = require("./spawn-node.cjs");

test("stringEnv copies process env and strips ELECTRON_RUN_AS_NODE", () => {
  const previous = process.env.ELECTRON_RUN_AS_NODE;
  process.env.ELECTRON_RUN_AS_NODE = "1";
  try {
    const env = stringEnv({ PORT: "3456", HOSTNAME: "127.0.0.1" });
    assert.equal(env.PORT, "3456");
    assert.equal(env.HOSTNAME, "127.0.0.1");
    assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
    assert.ok(env.PATH || env.Path);
  } finally {
    if (previous == null) delete process.env.ELECTRON_RUN_AS_NODE;
    else process.env.ELECTRON_RUN_AS_NODE = previous;
  }
});
