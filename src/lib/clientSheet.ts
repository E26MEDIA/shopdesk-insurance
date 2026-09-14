import { customerBalanceDue, type Policy } from "./types";
import { saveOrPrintReport } from "./printHtml";

function esc(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** Save/download renewal sheet PDF by date into insurance desk reports folder. */
export async function downloadClientSheet(opts: {
  title: string;
  policies: Policy[];
  date?: string;
}) {
  const { title, policies, date } = opts;
  const rows = policies
    .map(
      (p) => `<tr>
      <td>${esc(p.regNo)}</td>
      <td>${esc(p.vehicleMode)}</td>
      <td>${esc(p.variant)}</td>
      <td>${esc(p.portal)}</td>
      <td>${esc(p.company)}</td>
      <td>${p.payment || ""}</td>
      <td>${p.received || ""}</td>
      <td style="${customerBalanceDue(p) ? "color:#b91c1c;font-weight:700" : ""}">${customerBalanceDue(p) || ""}</td>
      <td>${esc(p.clientName)}</td>
      <td>${esc(p.phone || p.contact)}</td>
      <td>${esc(p.description)}</td>
      <td>${esc(fmtDate(p.expiryDate))}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
    th { background: #eee; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <table>
    <thead>
      <tr>
        <th>REG NO</th>
        <th>MODEL</th>
        <th>VARIANT</th>
        <th>PORTAL</th>
        <th>Company</th>
        <th>Payments</th>
        <th>Receipts</th>
        <th>Balance due</th>
        <th>Ins Owner</th>
        <th>CONTACT N</th>
        <th>Description</th>
        <th>RENEWAL</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="12">No rows</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  return saveOrPrintReport({
    html,
    kind: "renewal-sheet",
    date: date || new Date().toISOString().slice(0, 10),
  });
}
