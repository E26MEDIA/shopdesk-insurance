const TOMBSTONE_LIMIT = 800;

export function unionDeletedIds(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list || []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  if (out.length <= TOMBSTONE_LIMIT) return out;
  return out.slice(out.length - TOMBSTONE_LIMIT);
}

export function withoutDeletedPolicies<T extends { id: string }>(
  policies: T[],
  deletedIds: string[] | undefined,
): T[] {
  if (!deletedIds?.length) return policies;
  const deleted = new Set(deletedIds);
  return policies.filter((policy) => !deleted.has(policy.id));
}
