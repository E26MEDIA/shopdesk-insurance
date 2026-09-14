import { formatINR } from "@/lib/utils";

export function BalanceDue({
  amount,
  empty = "—",
}: {
  amount: number;
  empty?: string;
}) {
  if (!amount) {
    return <span className="text-slate-500">{empty}</span>;
  }
  return <span className="font-semibold text-red-700">{formatINR(amount)}</span>;
}
