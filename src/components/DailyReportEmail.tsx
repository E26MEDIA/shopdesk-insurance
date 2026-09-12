"use client";

import { useEffect, useRef } from "react";
import { downloadMonthlyExcel } from "@/lib/excelDownload";
import { downloadMonthlyPdf } from "@/lib/monthlyPdf";
import { isOfflineDesktop } from "@/lib/persist";
import {
  DAILY_EMAIL_HOUR,
  DAILY_EMAIL_SENT_KEY,
  composeReportEmail,
  reportMailBody,
  reportMailSubject,
} from "@/lib/reportEmail";
import { useStore } from "@/lib/store";
import { inDateRange, todayISO } from "@/lib/utils";

export function DailyReportEmail() {
  const { data, ready } = useStore();
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!ready || !isOfflineDesktop()) return;
    let cancelled = false;

    async function sendIfDue() {
      const today = todayISO();
      if (localStorage.getItem(DAILY_EMAIL_SENT_KEY) === today) return;
      if (new Date().getHours() < DAILY_EMAIL_HOUR) return;
      const snapshot = dataRef.current;
      const policies = snapshot.policies.filter((p) => inDateRange(p.date, today, today));
      const puc = snapshot.pucEntries.filter((p) => inDateRange(p.date, today, today));
      const expenses = (snapshot.expenses || []).filter((e) => inDateRange(e.date, today, today));
      const pdf = await downloadMonthlyPdf({
        monthLabel: today,
        from: today,
        to: today,
        policies,
        pucEntries: puc,
        expenses,
        date: today,
        silent: true,
      });
      const excel = await downloadMonthlyExcel({
        monthLabel: today,
        from: today,
        to: today,
        policies,
        pucEntries: puc,
        expenses,
        date: today,
        silent: true,
      });
      if (cancelled) return;
      const files = [pdf?.path, excel?.path].filter(Boolean) as string[];
      await composeReportEmail({
        subject: reportMailSubject("daily report", today, today),
        text: reportMailBody({
          kind: "daily report and backup copy",
          from: today,
          to: today,
          files,
        }),
        files,
      });
      localStorage.setItem(DAILY_EMAIL_SENT_KEY, today);
    }

    void sendIfDue();
    const timer = window.setInterval(() => {
      void sendIfDue();
    }, 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready]);

  return null;
}
