"use client";

import { PageHeader } from "@/components/ui";
import { PucEditor } from "@/components/PucEditor";

export default function PucPage() {
  return (
    <div>
      <PageHeader
        title="PUC"
        subtitle="Edit the daily PUC total anytime. Saving the same date updates the existing amount."
      />
      <PucEditor />
    </div>
  );
}
