"use client";

import { PageHeader } from "@/components/ui";
import { PucEditor } from "@/components/PucEditor";

export default function PucPage() {
  return (
    <div>
      <PageHeader
        title="PUC"
        subtitle="PUC stays an edit option. Update the daily total anytime — the same date overwrites the saved amount."
      />
      <PucEditor />
    </div>
  );
}
