"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Field, Input, PageHeader } from "@/components/ui";
import { PortalPoBoard } from "@/components/PortalPoBoard";
import { monthRange, todayISO } from "@/lib/utils";

export default function PortalDetailPage() {
  const params = useParams<{ portal: string }>();
  const router = useRouter();
  const today = todayISO();
  const month = monthRange(0);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(today);
  const portalName = decodeURIComponent(params.portal || "");

  return (
    <div>
      <PageHeader title={portalName} subtitle="Detailed portal payout, received amount, discount, TDS, and policy information." />
      <div className="mb-4"><Button type="button" variant="secondary" onClick={() => router.back()}>← Back to portals</Button></div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="From date"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To date"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <PortalPoBoard asOf={to} from={from} portalName={portalName} />
    </div>
  );
}
