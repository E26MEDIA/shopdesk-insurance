import { isOfflineDesktop } from "./persist";

export const REPORT_EMAIL = "solutechetc@gmail.com";
export const DAILY_EMAIL_SENT_KEY = "shopdesk-daily-report-email-date";
export const DAILY_EMAIL_HOUR = 20;

export function reportMailSubject(kind: string, from: string, to: string) {
  const range = from === to ? from : `${from} to ${to}`;
  return `Insurance Desk ${kind} ${range}`;
}

export function reportMailBody(opts: {
  kind: string;
  from: string;
  to: string;
  files?: string[];
}) {
  const lines = [
    `Insurance Desk ${opts.kind}.`,
    `Dates: ${opts.from === opts.to ? opts.from : `${opts.from} to ${opts.to}`}.`,
    "",
    "PDF and Excel reports are attached when the mail app supports it.",
    "They are also saved in E:\\insurance desk\\report\\daily report.",
    "The main PC still keeps the 8:00 PM data backup (Admin → Back up shared data).",
  ];
  if (opts.files?.length) {
    lines.push("", "Files:", ...opts.files);
  }
  return lines.join("\n");
}

export async function composeReportEmail(opts: {
  subject: string;
  text: string;
  files?: string[];
}): Promise<{ ok: boolean; to: string }> {
  const to = REPORT_EMAIL;
  if (isOfflineDesktop() && window.shopdesk?.composeEmail) {
    const result = await window.shopdesk.composeEmail({
      to,
      subject: opts.subject,
      text: opts.text,
      files: opts.files,
    });
    return { ok: Boolean(result?.ok), to: result?.to || to };
  }
  const params = new URLSearchParams();
  params.set("subject", opts.subject);
  params.set("body", opts.text);
  window.location.href = `mailto:${to}?${params.toString()}`;
  return { ok: true, to };
}
