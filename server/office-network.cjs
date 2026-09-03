/*
 * Shared helpers for ShopDesk Office Server LAN addresses, URL parsing,
 * CORS, and UDP discovery. Used by the office server and the desktop app.
 */
const os = require("os");
const path = require("path");

const OFFICE_PORT = Number(process.env.SHOPDESK_OFFICE_PORT || 3457);
const DISCOVER_PORT = Number(process.env.SHOPDESK_OFFICE_DISCOVER_PORT || 3458);
const DISCOVER_PROBE = "SHOPDESK-DISCOVER";
const DISCOVER_REPLY_PREFIX = "SHOPDESK-OFFICE ";

function lanAddresses() {
  const addresses = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      const family = net.family === 4 || net.family === "IPv4";
      if (!family || net.internal || !net.address) continue;
      addresses.push(net.address);
    }
  }
  return addresses.sort(compareLanAddress);
}

function lanScore(ip) {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 2;
  if (ip.startsWith("169.254.")) return 9;
  return 5;
}

function compareLanAddress(a, b) {
  return lanScore(a) - lanScore(b) || a.localeCompare(b);
}

function lanUrls(port = OFFICE_PORT) {
  return lanAddresses().map((ip) => `http://${ip}:${port}`);
}

function broadcastAddresses() {
  const broadcasts = new Set(["255.255.255.255"]);
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      const family = net.family === 4 || net.family === "IPv4";
      if (!family || net.internal || !net.address || !net.netmask) continue;
      broadcasts.add(ipv4Broadcast(net.address, net.netmask));
    }
  }
  return [...broadcasts];
}

function ipv4Broadcast(address, netmask) {
  const ip = address.split(".").map(Number);
  const mask = netmask.split(".").map(Number);
  return ip.map((octet, i) => octet | (~mask[i] & 255)).join(".");
}

function subnetPrefixes() {
  return [...new Set(lanAddresses().filter((ip) => lanScore(ip) < 9).map((ip) => ip.split(".").slice(0, 3).join(".")))];
}

function normalizeOfficeServerUrl(raw, defaultPort = OFFICE_PORT) {
  let value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname) return "";
    if (!url.port) url.port = String(defaultPort);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return "";
  }
}

function isLoopbackOfficeUrl(raw) {
  const normalized = normalizeOfficeServerUrl(raw);
  let hostname = "";
  try {
    hostname = new URL(normalized || raw).hostname.toLowerCase();
  } catch {
    return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/i.test(String(raw || ""));
  }
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, If-Match, X-ShopDesk-Device, X-ShopDesk-Label, X-ShopDesk-Office-Key",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  };
}

function encodeDiscoverReply(payload) {
  return Buffer.from(`${DISCOVER_REPLY_PREFIX}${JSON.stringify(payload)}`);
}

function decodeDiscoverReply(message) {
  const text = String(message || "");
  if (!text.startsWith(DISCOVER_REPLY_PREFIX)) return null;
  try {
    const body = JSON.parse(text.slice(DISCOVER_REPLY_PREFIX.length));
    const unique = [...new Set(
      (Array.isArray(body.urls) ? body.urls : [])
        .map((url) => normalizeOfficeServerUrl(url))
        .filter(Boolean),
    )];
    if (!unique.length) return null;
    return { ok: true, port: Number(body.port) || OFFICE_PORT, urls: unique, startedAt: body.startedAt || "" };
  } catch {
    return null;
  }
}

function sanitizeDocumentPart(part, asFileName = false) {
  const cleaned = String(part || "")
    .trim()
    .replace(/[<>:"|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, asFileName ? 120 : 80);
  if (!cleaned || cleaned === "." || cleaned === "..") return "";
  return cleaned;
}

function safeDocumentRelPath(id) {
  const parts = String(id || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part, index, all) => sanitizeDocumentPart(part, index === all.length - 1))
    .filter(Boolean);
  if (!parts.length) return null;
  return parts.join("/");
}

function isInsideDir(root, file) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(file);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}

module.exports = {
  OFFICE_PORT,
  DISCOVER_PORT,
  DISCOVER_PROBE,
  DISCOVER_REPLY_PREFIX,
  lanAddresses,
  lanUrls,
  broadcastAddresses,
  subnetPrefixes,
  normalizeOfficeServerUrl,
  isLoopbackOfficeUrl,
  corsHeaders,
  encodeDiscoverReply,
  decodeDiscoverReply,
  sanitizeDocumentPart,
  safeDocumentRelPath,
  isInsideDir,
};

