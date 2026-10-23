import { testDataProvider } from "ra-core";
import { vi, expect, it } from "vitest";
import { makeBackup, resources, type Snapshot } from "./data";
import { inspectRestore, restoreBackup } from "./restore";

const fixture = (): Snapshot => ({
  sales: [{ id: 9 }],
  tags: [{ id: 1, name: "客户", color: "#ffffff" }],
  companies: [{ id: 1, name: "Acme", sales_id: 9 }],
  contacts: [{ id: 2, company_id: 1, tags: [1], first_name: "A", sales_id: 9 }],
  recruitment: [{ id: 3, company_id: 1, status: "confirmed", jobs: [] }],
  deals: [
    {
      id: 4,
      name: "Opportunity",
      company_id: 1,
      contact_ids: [2],
      stage: "contacted",
      sales_id: 9,
    },
  ],
  tasks: [
    { id: 5, contact_id: 2, recruitment_id: 3, text: "Follow up", sales_id: 9 },
  ],
  contact_notes: [{ id: 6, contact_id: 2, text: "Note", sales_id: 9 }],
  deal_notes: [{ id: 7, deal_id: 4, text: "Deal note", sales_id: 9 }],
});
const fakeTarget = () => {
  const tables = Object.fromEntries(
    resources.map((r) => [r, []]),
  ) as unknown as Snapshot;
  tables.sales = [{ id: 99, disabled: false }];
  let id = 100;
  const create = vi.fn(async (resource, { data }) => {
    const row = { ...structuredClone(data), id: ++id };
    tables[resource as keyof Snapshot].push(row);
    return { data: row };
  });
  const provider = testDataProvider({
    create,
    getList: async (resource) => ({
      data: tables[resource as keyof Snapshot] as any,
      total: tables[resource as keyof Snapshot].length,
    }),
    getOne: async (resource, { id }) => ({
      data: tables[resource as keyof Snapshot].find((r) => r.id === id)! as any,
    }),
  });
  return { tables, create, provider };
};

it("restores all business types, remaps references and reads back contents", async () => {
  const target = fakeTarget();
  const backup = await makeBackup(fixture(), new Date().toISOString());
  const result = await restoreBackup(
    target.provider,
    backup,
    99,
    async () => true,
  );
  expect(result.count).toBe(8);
  expect(target.tables.tasks[0].contact_id).toBe(target.tables.contacts[0].id);
  expect(target.tables.tasks[0].recruitment_id).toBe(
    target.tables.recruitment[0].id,
  );
  expect(target.tables.deals[0].contact_ids).toEqual([
    target.tables.contacts[0].id,
  ]);
  expect(target.tables.contacts[0].tags).toEqual([target.tables.tags[0].id]);
  expect(target.tables.contact_notes[0].sales_id).toBe(99);
  expect(target.tables.sales).toHaveLength(1);
});
it("rejects a missing reference before writing", async () => {
  const data = fixture();
  data.tasks[0].contact_id = 123;
  const backup = await makeBackup(data, new Date().toISOString());
  await expect(inspectRestore(backup)).rejects.toThrow("不存在");
  const target = fakeTarget();
  await expect(
    restoreBackup(target.provider, backup, 99, async () => true),
  ).rejects.toThrow();
  expect(target.create).not.toHaveBeenCalled();
});
it("blocks non-admins and nonempty target databases without any writes", async () => {
  const target = fakeTarget();
  const backup = await makeBackup(fixture(), new Date().toISOString());
  await expect(
    restoreBackup(target.provider, backup, 99, async () => false),
  ).rejects.toThrow("管理员");
  target.tables.companies.push({ id: 1, name: "Existing" });
  await expect(
    restoreBackup(target.provider, backup, 99, async () => true),
  ).rejects.toThrow("不是空表");
  expect(target.create).not.toHaveBeenCalled();
});
it("stops on a write failure and reports partial writes without automatic deletion or retry", async () => {
  const target = fakeTarget();
  target.create.mockRejectedValueOnce(new Error("Network failure"));
  await expect(
    restoreBackup(
      target.provider,
      await makeBackup(fixture(), new Date().toISOString()),
      99,
      async () => true,
    ),
  ).rejects.toThrow("已成功创建 0 条");
  expect(target.create).toHaveBeenCalledTimes(1);
});
it("does not report success when readback contents differ", async () => {
  const target = fakeTarget();
  const getOne = target.provider.getOne;
  target.provider.getOne = async (resource, params) => {
    const result = await getOne(resource, params);
    return resource === "companies"
      ? { data: { ...result.data, name: "Corrupted" } }
      : result;
  };
  await expect(
    restoreBackup(
      target.provider,
      await makeBackup(fixture(), new Date().toISOString()),
      99,
      async () => true,
    ),
  ).rejects.toThrow("回读校验不一致");
});
