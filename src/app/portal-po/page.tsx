"use client";

import { PageHeader } from "@/components/ui";
import { PortalPoBoard } from "@/components/PortalPoBoard";
import { todayISO } from "@/lib/utils";

export default function PortalPoPage() {
  const today = todayISO();
  return (
    <div>
      <PageHeader
        title="Portal PO"
        subtitle="How much is still to come from each portal, how much is received, and how much is pending."
      />
      <PortalPoBoard asOf={today} />
    </div>
  );
}
