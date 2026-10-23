import type { DataProvider, RaRecord } from "ra-core";

export const resources = [
  "companies",
  "contacts",
  "recruitment",
  "deals",
  "tasks",
  "contact_notes",
  "deal_notes",
  "tags",
  "sales",
] as const;
export type Snapshot = Record<(typeof resources)[number], RaRecord[]>;

// Small, consistently sorted pages work with the server's response limit.
export async function readAll(provider: DataProvider, resource: string) {
  const rows: RaRecord[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  for (let page = 1; ; page++) {
    const result = await provider.getList(resource, {
      pagination: { page, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    if (
      expected !== undefined &&
      result.total !== undefined &&
      result.total !== expected
    )
      throw new Error("读取期间数据发生变化，请重新加载。");
    expected ??= result.total;
    for (const row of result.data) {
      if (ids.has(String(row.id)))
        throw new Error("读取到重复分页，请重新加载。");
      ids.add(String(row.id));
      rows.push(row);
    }
    if (expected !== undefined && rows.length === expected) return rows;
    if (!result.data.length) {
      if (expected !== undefined && rows.length !== expected)
        throw new Error("数据未完整加载，请重试。");
      return rows;
    }
    if (expected === undefined && result.pageInfo?.hasNextPage === false)
      return rows;
  }
}

export async function loadSnapshot(provider: DataProvider): Promise<Snapshot> {
  const entries = await Promise.all(
    resources.map(async (resource) => [
      resource,
      await readAll(provider, resource),
    ]),
  );
  const snapshot = Object.fromEntries(entries) as Snapshot;
  // Never include auth fields or demo passwords from team records.
  snapshot.sales = snapshot.sales.map(
    ({ id, first_name, last_name, disabled }) => ({
      id,
      first_name,
      last_name,
      disabled,
    }),
  );
  return snapshot;
}

const normalized = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")
    : "";
const present = (value: unknown) => normalized(value).length > 0;
const key = (id: unknown) => (id == null ? "" : String(id));
export type QualityIssue = {
  id: string;
  kind: string;
  resource: "companies" | "contacts";
  recordId: string | number;
  name: string;
  detail: string;
};

export function qualityIssues(data: Snapshot): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const names = new Map<string, RaRecord[]>();
  const emails = new Map<string, RaRecord[]>();
  const activeOwners = new Set(
    data.sales.filter((s) => !s.disabled).map((s) => key(s.id)),
  );
  const companyContacts = new Map<string, RaRecord[]>();
  for (const contact of data.contacts) {
    const company = key(contact.company_id);
    companyContacts.set(company, [
      ...(companyContacts.get(company) ?? []),
      contact,
    ]);
    for (const email of new Set<string>(
      (contact.email_jsonb ?? [])
        .map((e: { email: string }) => normalized(e.email))
        .filter(Boolean),
    )) {
      emails.set(email, [...(emails.get(email) ?? []), contact]);
    }
  }
  const pendingContacts = new Set(
    data.tasks.filter((t) => !t.done_date).map((t) => key(t.contact_id)),
  );
  const pendingLeads = new Set(
    data.tasks.filter((t) => !t.done_date).map((t) => key(t.recruitment_id)),
  );
  const add = (
    row: RaRecord,
    kind: string,
    detail: string,
    resource: "companies" | "contacts" = "companies",
  ) =>
    issues.push({
      id: `${resource}-${row.id}-${kind}-${detail}`,
      kind,
      resource,
      recordId: row.id,
      name:
        row.name ||
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        `#${row.id}`,
      detail,
    });
  for (const company of data.companies) {
    const name = normalized(company.name);
    if (name) names.set(name, [...(names.get(name) ?? []), company]);
    if (!present(company.country))
      add(company, "缺少国家", "补充国家 / 地区，便于客户分组。");
    if (!activeOwners.has(key(company.sales_id)))
      add(
        company,
        "负责人异常",
        "未分配负责人，或负责人已停用，请管理员处理。",
      );
    const contacts = companyContacts.get(key(company.id)) ?? [];
    const hasContact =
      present(company.email) ||
      present(company.phone_number) ||
      contacts.some(
        (c) =>
          (c.email_jsonb ?? []).some((e: { email: string }) =>
            present(e.email),
          ) ||
          (c.phone_jsonb ?? []).some((p: { number: string }) =>
            present(p.number),
          ),
      );
    if (!hasContact)
      add(company, "缺少联系方式", "公司及其联系人均未填写邮箱或电话。");
    const leads = data.recruitment.filter(
      (r) => key(r.company_id) === key(company.id),
    );
    if (
      leads.some((r) =>
        ["confirmed", "contacted", "replied"].includes(r.status),
      ) &&
      !contacts.some((c) => pendingContacts.has(key(c.id))) &&
      !leads.some((r) => pendingLeads.has(key(r.id)))
    )
      add(
        company,
        "缺少下次跟进",
        "已有确认或联系中的招聘线索，但没有待办跟进任务。",
      );
  }
  for (const group of names.values())
    if (group.length > 1)
      for (const row of group)
        add(
          row,
          "疑似重复公司",
          `同名记录共 ${group.length} 条，请核对后人工处理。`,
        );
  for (const [email, group] of emails)
    if (group.length > 1)
      for (const row of group)
        add(
          row,
          "重复联系人邮箱",
          `${email} 出现在 ${group.length} 个联系人中。`,
          "contacts",
        );
  return issues;
}

export function businessReport(
  data: Snapshot,
  from: Date,
  until: Date,
  owner: string,
  now = new Date(),
) {
  const owned = (row: RaRecord) => !owner || key(row.sales_id) === owner;
  const inPeriod = (value: unknown) =>
    typeof value === "string" &&
    new Date(value) >= from &&
    new Date(value) < until;
  const companyById = new Map(data.companies.map((c) => [key(c.id), c]));
  const leads = data.recruitment.filter(
    (r) =>
      !owner || key(companyById.get(key(r.company_id))?.sales_id) === owner,
  );
  const tasks = data.tasks.filter(owned);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const stages: Record<string, number> = {};
  const stageCompanies = new Map<string, Set<string>>();
  for (const deal of data.deals.filter(
    (d) => owned(d) && !d.archived_at && d.company_id != null,
  )) {
    const set = stageCompanies.get(deal.stage) ?? new Set();
    set.add(key(deal.company_id));
    stageCompanies.set(deal.stage, set);
  }
  for (const [stage, companies] of stageCompanies)
    stages[stage] = companies.size;
  const contacted = new Set<string>(),
    replied = new Set<string>();
  for (const lead of leads) {
    if (["contacted", "replied"].includes(lead.status))
      contacted.add(key(lead.company_id));
    if (lead.status === "replied") replied.add(key(lead.company_id));
  }
  for (const deal of data.deals.filter(
    (d) => owned(d) && !d.archived_at && d.company_id != null,
  )) {
    if (["contacted", "replied", "demo", "trial", "won"].includes(deal.stage))
      contacted.add(key(deal.company_id));
    if (["replied", "demo", "trial", "won"].includes(deal.stage))
      replied.add(key(deal.company_id));
  }
  return {
    contactedCompanies: contacted.size,
    repliedCompanies: replied.size,
    replyRate: contacted.size ? replied.size / contacted.size : null,
    newCompanies: data.companies.filter(
      (c) => owned(c) && inPeriod(c.created_at),
    ).length,
    newLeads: leads.filter((r) => inPeriod(r.created_at)).length,
    completedTasks: tasks.filter((t) => inPeriod(t.done_date)).length,
    notes: [...data.contact_notes, ...data.deal_notes].filter(
      (n) => owned(n) && inPeriod(n.date),
    ).length,
    pendingTasks: tasks.filter((t) => !t.done_date).length,
    overdueTasks: tasks.filter(
      (t) => !t.done_date && new Date(t.due_date) < today,
    ).length,
    stages,
  };
}

async function checksum(data: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function makeBackup(data: Snapshot, startedAt: string) {
  return {
    format: "VBerCRM-business-snapshot",
    version: 1,
    startedAt,
    exportedAt: new Date().toISOString(),
    scope:
      "可访问的业务记录；不包含账号凭据、附件文件、数据库配置。读取期间请暂停编辑，此文件不是数据库事务快照，也不能直接用于原有 JSON 导入入口。",
    counts: Object.fromEntries(resources.map((r) => [r, data[r].length])),
    checksum: await checksum(data),
    data,
  };
}
export async function validateBackup(
  value: unknown,
): Promise<Record<string, number>> {
  if (!value || typeof value !== "object")
    throw new Error("不是有效的备份文件。");
  const backup = value as Awaited<ReturnType<typeof makeBackup>>;
  if (
    backup.format !== "VBerCRM-business-snapshot" ||
    backup.version !== 1 ||
    !backup.data ||
    !backup.counts
  )
    throw new Error("文件格式或版本不支持。");
  for (const resource of resources) {
    const rows = backup.data[resource];
    if (
      !Array.isArray(rows) ||
      rows.length !== backup.counts[resource] ||
      rows.some((row) => !row || row.id == null) ||
      new Set(rows.map((row) => key(row.id))).size !== rows.length
    )
      throw new Error(`${resource} 的记录数量或标识不正确。`);
  }
  if ((await checksum(backup.data)) !== backup.checksum)
    throw new Error("文件校验失败，数据可能已被修改或损坏。");
  return backup.counts;
}
