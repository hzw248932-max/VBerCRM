// Nested list/create controllers can inherit their parent's record context.
// Only an existing child write needs its parent owner resolved. Shared reads
// must not look for a child foreign key on the inherited parent record.
export async function resolveAccessRecord(
  params: { action: string; resource: string; record?: Record<string, any> },
  loadOwner: (
    resource: string,
    id: string | number,
  ) => Promise<{ sales_id: number | null } | null>,
) {
  const parent = (
    {
      recruitment: ["companies", "company_id"],
      contact_notes: ["contacts", "contact_id"],
      deal_notes: ["deals", "deal_id"],
    } as Record<string, string[]>
  )[params.resource];
  if (
    !parent ||
    !params.record ||
    !["edit", "update", "delete"].includes(params.action)
  ) {
    return params.record;
  }
  const id = params.record[parent[1]];
  if (id == null) return null;
  const owner = await loadOwner(parent[0], id);
  return owner ? { ...params.record, sales_id: owner.sales_id } : null;
}
