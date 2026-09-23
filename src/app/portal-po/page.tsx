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
        subtitle="Company offer % earning for each portal, the money you type as received, and what is still pending."
      />
      <PortalPoBoard asOf={today} />
    </div>
  );
}
