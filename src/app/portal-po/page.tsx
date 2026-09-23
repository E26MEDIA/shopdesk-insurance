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
        subtitle="Every portal is listed. Estimated profit from insurance is added to that portal. Type what you received, and pending updates."
      />
      <PortalPoBoard asOf={today} />
    </div>
  );
}
