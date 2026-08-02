"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** PUC is entered from Reports */
export default function PucRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports");
  }, [router]);
  return <p className="text-sm text-slate-600">Opening Reports for PUC…</p>;
}
