"use client";

import { Suspense } from "react";
import { PolicyForm } from "@/components/PolicyForm";
import { PageHeader } from "@/components/ui";
import { blankPolicy } from "@/lib/types";

function NewInsuranceInner() {
  return (
    <div>
      <PageHeader
        title="New insurance"
        subtitle="Enter client and vehicle details manually for each customer"
      />
      <PolicyForm initial={blankPolicy()} />
    </div>
  );
}

export default function NewInsurancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <NewInsuranceInner />
    </Suspense>
  );
}
