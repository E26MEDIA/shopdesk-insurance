const fs = require("fs");
const path = require("path");

const DEFAULT_REPORT_EMAIL = "solutechetc@gmail.com";

function reportEmail() {
  return String(process.env.SHOPDESK_REPORT_EMAIL || DEFAULT_REPORT_EMAIL).trim() || DEFAULT_REPORT_EMAIL;
}

function foldBase64(value) {
  return String(value || "").replace(/(.{76})/g, "$1\r\n");
}

function mimeForName(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

function safeHeader(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function buildUnsentEml({ to, subject, text, files }) {
  const boundary = `----=_ShopDesk_${Date.now()}`;
  const lines = [
    "X-Unsent: 1",
    `To: ${safeHeader(to || reportEmail())}`,
    `Subject: ${safeHeader(subject || "Insurance Desk report")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "Content-Transfer-Encoding: 8bit",
    "",
    String(text || ""),
    "",
  ];

  for (const file of files || []) {
    if (!file || !fs.existsSync(file)) continue;
    const name = path.basename(file);
    const data = fs.readFileSync(file);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${mimeForName(name)}; name="${name}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${name}"`);
    lines.push("");
    lines.push(foldBase64(data.toString("base64")));
    lines.push("");
  }

  lines.push(`--${boundary}--`);
  lines.push("");
  return lines.join("\r\n");
}

function mailtoUrl({ to, subject, text, files }) {
  const body = [String(text || "").trim(), ...(files || []).filter(Boolean).map((file) => String(file))]
    .filter(Boolean)
    .join("\n\n");
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${encodeURIComponent(to || reportEmail())}?${params.toString()}`;
}

module.exports = {
  DEFAULT_REPORT_EMAIL,
  reportEmail,
  buildUnsentEml,
  mailtoUrl,
  mimeForName,
};
