const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildUnsentEml, mailtoUrl, reportEmail, DEFAULT_REPORT_EMAIL } = require("./compose-email.cjs");

test("report email defaults to solutechetc@gmail.com", () => {
  assert.equal(DEFAULT_REPORT_EMAIL, "solutechetc@gmail.com");
  assert.equal(reportEmail(), "solutechetc@gmail.com");
});

test("unsent eml includes the report address and attachments", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopdesk-mail-"));
  const file = path.join(dir, "2026-09-12_daily-report.pdf");
  fs.writeFileSync(file, "pdf-bytes");
  const eml = buildUnsentEml({
    to: "solutechetc@gmail.com",
    subject: "Daily report 2026-09-12",
    text: "Insurance Desk daily report",
    files: [file],
  });
  assert.match(eml, /X-Unsent: 1/);
  assert.match(eml, /To: solutechetc@gmail.com/);
  assert.match(eml, /filename="2026-09-12_daily-report.pdf"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("mailto fallback points at the shop report inbox", () => {
  const url = mailtoUrl({
    to: "solutechetc@gmail.com",
    subject: "Daily report",
    text: "See attached files",
    files: ["E:\\insurance desk\\report\\daily report\\today.pdf"],
  });
  assert.match(url, /^mailto:solutechetc%40gmail.com/);
  assert.match(url, /Daily\+report/);
});
