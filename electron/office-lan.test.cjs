const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { officeLanInfo } = require("./office-lan.cjs");

describe("office LAN address", () => {
  it("never tells the other laptop to use localhost", () => {
    const info = officeLanInfo({
      WiFi: [
        { family: "IPv4", address: "192.168.1.50", internal: false },
        { family: "IPv4", address: "127.0.0.1", internal: true },
      ],
    });
    assert.equal(info.localUrl, "http://127.0.0.1:3457");
    assert.deepEqual(info.lanUrls, ["http://192.168.1.50:3457"]);
    assert.equal(
      info.lanUrls.some((url) => url.includes("localhost") || url.includes("127.0.0.1")),
      false,
    );
  });

  it("skips empty interface lists", () => {
    const info = officeLanInfo({ Ethernet: undefined });
    assert.deepEqual(info.lanUrls, []);
  });
});
