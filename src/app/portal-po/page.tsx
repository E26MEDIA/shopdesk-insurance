"use client";

import { PageHeader, Input, Field } from "@/components/ui";
import { useState } from "react";
import { PortalPoBoard } from "@/components/PortalPoBoard";
import { todayISO, monthRange } from "@/lib/utils";

export default function PortalPoPage() {
  const today = todayISO();
  const month = monthRange(0);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(today);
  return (
    <div>
      <PageHeader
        title="Portal PO"
        subtitle="Every portal is listed. Estimated profit from insurance is added to that portal. Type what you received, and pending updates."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="From date"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To date"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <PortalPoBoard asOf={to} from={from} />
    </div>
  );
}
