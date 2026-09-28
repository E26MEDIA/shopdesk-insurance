import type { AppData } from "./types";
import { unionDeletedIds, withoutDeletedPolicies } from "./deletedRecords";
import { DEFAULT_DOCUMENT_LABELS } from "./utils";

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeRows<T extends { id: string }>(base: T[], mine: T[], theirs: T[]): T[] {
  const baseMap = new Map(base.map((row) => [row.id, row]));
  const mineMap = new Map(mine.map((row) => [row.id, row]));
  const theirMap = new Map(theirs.map((row) => [row.id, row]));
  const ids = new Set([...baseMap.keys(), ...mineMap.keys(), ...theirMap.keys()]);
  const merged: T[] = [];
  for (const id of ids) {
    const before = baseMap.get(id);
    const ours = mineMap.get(id);
    const current = theirMap.get(id);
    // A change made on just one computer wins; if the same row was edited on
    // both computers, keep this computer's version and avoid losing other rows.
    const result = same(ours, before) ? current : ours;
    if (result) merged.push(result);
  }
  return merged;
}

export function mergeAppData(base: AppData, mine: AppData, theirs: AppData): AppData {
  const deletedPolicyIds = unionDeletedIds(
    base.deletedPolicyIds,
    mine.deletedPolicyIds,
    theirs.deletedPolicyIds,
  );
  return {
    ...theirs,
    deletedPolicyIds,
    clients: mergeRows(base.clients, mine.clients, theirs.clients),
    vehicles: mergeRows(base.vehicles, mine.vehicles, theirs.vehicles),
    policies: withoutDeletedPolicies(
      mergeRows(base.policies, mine.policies, theirs.policies),
      deletedPolicyIds,
    ),
    pucEntries: mergeRows(base.pucEntries || [], mine.pucEntries || [], theirs.pucEntries || []),
    expenses: mergeRows(base.expenses || [], mine.expenses || [], theirs.expenses || []),
    adjustments: mergeRows(base.adjustments || [], mine.adjustments || [], theirs.adjustments || []),
    portalReceipts: mergeRows(base.portalReceipts || [], mine.portalReceipts || [], theirs.portalReceipts || []),
    cashOpenings: mergeRows(base.cashOpenings || [], mine.cashOpenings || [], theirs.cashOpenings || []),
    openingEntries: mergeRows(base.openingEntries || [], mine.openingEntries || [], theirs.openingEntries || []),
    advances: mergeRows(base.advances || [], mine.advances || [], theirs.advances || []),
    documentLabels: {
      ...DEFAULT_DOCUMENT_LABELS,
      ...(base.documentLabels || {}),
      ...(theirs.documentLabels || {}),
      ...(mine.documentLabels || {}),
    },
    formFields: mergeRows(base.formFields, mine.formFields, theirs.formFields),
    masters: Object.fromEntries(
      Object.keys({ ...base.masters, ...mine.masters, ...theirs.masters }).map((key) => [
        key,
        mergeRows(
          base.masters[key as keyof AppData["masters"]] || [],
          mine.masters[key as keyof AppData["masters"]] || [],
          theirs.masters[key as keyof AppData["masters"]] || [],
        ),
      ]),
    ) as AppData["masters"],
  };
}
