import type { DataProvider, Identifier } from "ra-core";
import isEqual from "lodash/isEqual";
import { readAll, validateBackup, type Snapshot } from "./data";

const fields = {
  tags: "name color",
  companies:
    "name sector size linkedin_url website email phone_number address zipcode city state_abbr context_links country description revenue tax_identifier logo created_at sales_id",
  contacts:
    "first_name last_name gender title background avatar first_seen has_newsletter status tags company_id sales_id linkedin_url email_jsonb phone_jsonb",
  recruitment:
    "company_id jobs pain_points matched_features score business_email email_source email_verified status created_at",
  deals:
    "name company_id contact_ids category stage description amount created_at archived_at expected_closing_date sales_id index",
  tasks:
    "contact_id recruitment_id type text due_date done_date sales_id created_at",
  contact_notes: "contact_id text date sales_id status attachments",
  deal_notes: "deal_id type text date sales_id attachments",
} as const;
export const restoreOrder = Object.keys(fields) as (keyof typeof fields)[];
type Resource = (typeof restoreOrder)[number];
const references: Partial<Record<Resource, Record<string, Resource>>> = {
  contacts: { company_id: "companies", tags: "tags" },
  recruitment: { company_id: "companies" },
  deals: { company_id: "companies", contact_ids: "contacts" },
  tasks: { contact_id: "contacts", recruitment_id: "recruitment" },
  contact_notes: { contact_id: "contacts" },
  deal_notes: { deal_id: "deals" },
};
const required: Partial<Record<Resource, string[]>> = {
  tags: ["name", "color"],
  companies: ["name"],
  recruitment: ["company_id", "status"],
  deals: ["name", "stage"],
  tasks: ["contact_id"],
  contact_notes: ["contact_id"],
  deal_notes: ["deal_id"],
};
const validId = (id: unknown) =>
  (typeof id === "number" && Number.isSafeInteger(id) && id >= 0) ||
  (typeof id === "string" && /^\d+$/.test(id));

export async function inspectRestore(value: unknown): Promise<Snapshot> {
  await validateBackup(value);
  const data = (value as { data: Snapshot }).data;
  for (const resource of restoreOrder)
    for (const row of data[resource]) {
      if (!validId(row.id)) throw new Error(`${resource} 的记录编号无效。`);
      for (const field of required[resource] ?? [])
        if (row[field] == null || row[field] === "")
          throw new Error(`${resource} #${row.id} 缺少 ${field}。`);
      for (const [field, target] of Object.entries(
        references[resource] ?? {},
      )) {
        const value = row[field];
        if (value == null) continue;
        if (["tags", "contact_ids"].includes(field) && !Array.isArray(value))
          throw new Error(`${resource}.${field} 必须为数组。`);
        for (const id of Array.isArray(value) ? value : [value]) {
          if (
            !validId(id) ||
            !data[target].some((r) => String(r.id) === String(id))
          )
            throw new Error(
              `${resource} #${row.id} 的 ${field} 引用了不存在的记录。`,
            );
        }
      }
    }
  const companies = new Set<string>(),
    openLeads = new Set<string>();
  for (const row of data.recruitment) {
    if (companies.has(String(row.company_id)))
      throw new Error("同一公司有多条招聘线索，无法恢复。");
    companies.add(String(row.company_id));
    if (!["research", "confirmed", "contacted", "replied"].includes(row.status))
      throw new Error("招聘线索状态无效。");
  }
  for (const row of data.tasks)
    if (!row.done_date && row.recruitment_id != null) {
      if (openLeads.has(String(row.recruitment_id)))
        throw new Error("同一招聘线索有多条未完成任务，无法恢复。");
      openLeads.add(String(row.recruitment_id));
    }
  return data;
}

// Restore only into an empty business dataset. IDs are allocated by the target
// and foreign keys are remapped; team accounts are never recreated from JSON.
export async function restoreBackup(
  provider: DataProvider,
  value: unknown,
  ownerId: Identifier,
  authorize: () => Promise<boolean>,
  progress: (count: number) => void = () => {},
) {
  if (!(await authorize())) throw new Error("仅管理员可恢复备份。");
  const data = await inspectRestore(value);
  const owner = await provider.getOne("sales", { id: ownerId });
  if (owner.data.disabled) throw new Error("请选择有效负责人。");
  for (const resource of restoreOrder) {
    const current = await readAll(provider, resource);
    if (current.length)
      throw new Error(
        `目标库的 ${resource} 不是空表。请使用空的测试库，不会覆盖或删除现有记录。`,
      );
  }
  if (!(await authorize())) throw new Error("管理员权限已失效。");
  const mapping = Object.fromEntries(
    restoreOrder.map((r) => [r, new Map<string, Identifier>()]),
  ) as Record<Resource, Map<string, Identifier>>;
  const written: {
    resource: Resource;
    id: Identifier;
    expected: Record<string, unknown>;
  }[] = [];
  try {
    for (const resource of restoreOrder)
      for (const row of data[resource]) {
        const payload: Record<string, unknown> = {};
        for (const field of fields[resource].split(" "))
          if (row[field] !== undefined) payload[field] = row[field];
        if (fields[resource].includes("sales_id")) payload.sales_id = ownerId;
        for (const [field, target] of Object.entries(
          references[resource] ?? {},
        )) {
          const original = row[field];
          if (original == null) continue;
          payload[field] = Array.isArray(original)
            ? original.map((id) => mapping[target].get(String(id)))
            : mapping[target].get(String(original));
        }
        const result = await provider.create(resource, { data: payload });
        mapping[resource].set(String(row.id), result.data.id);
        written.push({ resource, id: result.data.id, expected: payload });
        progress(written.length);
      }
    // Read back after all writes: verify content and remapped references, not
    // just successful HTTP responses or row counts.
    for (const { resource, id, expected } of written) {
      const { data: actual } = await provider.getOne(resource, { id });
      for (const [field, value] of Object.entries(expected)) {
        if (
          !isEqual(comparable(field, actual[field]), comparable(field, value))
        )
          throw new Error(`${resource} #${id} 的 ${field} 回读校验不一致。`);
      }
    }
    for (const resource of restoreOrder)
      if ((await readAll(provider, resource)).length !== data[resource].length)
        throw new Error(`${resource} 恢复后的数量不一致。`);
    return {
      count: written.length,
      mapping: Object.fromEntries(
        restoreOrder.map((r) => [r, Object.fromEntries(mapping[r])]),
      ),
    };
  } catch (error) {
    throw new Error(
      `恢复未完成：已成功创建 ${written.length} 条记录，可能还存在请求结果未知的记录。请停止重试并核对目标库；本操作不会自动删除已写入数据。${error instanceof Error ? error.message : "写入失败"}`,
    );
  }
}

function comparable(field: string, value: unknown): unknown {
  if (value == null) return null;
  if (
    [
      "created_at",
      "first_seen",
      "archived_at",
      "due_date",
      "done_date",
      "date",
    ].includes(field) &&
    (typeof value === "string" || value instanceof Date)
  )
    return new Date(value).getTime();
  if (field.endsWith("_id")) return String(value);
  if (["tags", "contact_ids"].includes(field) && Array.isArray(value))
    return value.map(String).sort();
  return value;
}
