const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeOfficeServerUrl,
  isLoopbackOfficeUrl,
  corsHeaders,
  encodeDiscoverReply,
  decodeDiscoverReply,
} = require("./office-network.cjs");

test("adds http and port 3457 to a bare LAN IP", () => {
  assert.equal(normalizeOfficeServerUrl("192.168.1.50"), "http://192.168.1.50:3457");
  assert.equal(normalizeOfficeServerUrl("192.168.1.50:3457"), "http://192.168.1.50:3457");
  assert.equal(normalizeOfficeServerUrl("http://192.168.1.50"), "http://192.168.1.50:3457");
  assert.equal(normalizeOfficeServerUrl("http://192.168.1.50:3457/"), "http://192.168.1.50:3457");
});

test("rejects empty or invalid office addresses", () => {
  assert.equal(normalizeOfficeServerUrl(""), "");
  assert.equal(normalizeOfficeServerUrl("not a url"), "");
  assert.equal(normalizeOfficeServerUrl("://bad"), "");
});

test("detects localhost so the second laptop is not told to use it", () => {
  assert.equal(isLoopbackOfficeUrl("localhost"), true);
  assert.equal(isLoopbackOfficeUrl("http://localhost:3457"), true);
  assert.equal(isLoopbackOfficeUrl("http://127.0.0.1:3457"), true);
  assert.equal(isLoopbackOfficeUrl("http://192.168.1.50:3457"), false);
});

test("CORS headers allow the office access key used by other PCs", () => {
  const headers = corsHeaders();
  assert.match(headers["Access-Control-Allow-Headers"], /X-ShopDesk-Office-Key/);
  assert.equal(headers["Access-Control-Allow-Private-Network"], "true");
  assert.equal(headers["Access-Control-Allow-Origin"], "*");
});

test("keeps customer folder names in document ids", () => {
  const { safeDocumentRelPath } = require("./office-network.cjs");
  assert.equal(safeDocumentRelPath("Ramesh Kumar/rc_scan.pdf"), "Ramesh Kumar/rc_scan.pdf");
  assert.equal(safeDocumentRelPath("..\\secret"), "secret");
  assert.equal(safeDocumentRelPath(""), null);
});

test("UDP discovery replies round-trip the advertised LAN URLs", () => {
  const encoded = encodeDiscoverReply({
    ok: true,
    port: 3457,
    urls: ["http://192.168.1.50:3457", "http://10.0.0.8:3457"],
  });
  const decoded = decodeDiscoverReply(encoded);
  assert.deepEqual(decoded.urls, ["http://192.168.1.50:3457", "http://10.0.0.8:3457"]);
  assert.equal(decodeDiscoverReply("nope"), null);
});
