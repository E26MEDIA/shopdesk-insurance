const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stringEnv } = require("./spawn-node.cjs");

test("stringEnv copies process env and overrides PORT/HOSTNAME", () => {
  const env = stringEnv({ PORT: "3456", HOSTNAME: "127.0.0.1" });
  assert.equal(env.PORT, "3456");
  assert.equal(env.HOSTNAME, "127.0.0.1");
  assert.ok(env.PATH || env.Path);
});
