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
        subtitle="Each portal shows the earning from its insurance, the money you type as received, and what is still pending."
      />
      <PortalPoBoard asOf={today} />
    </div>
  );
}
