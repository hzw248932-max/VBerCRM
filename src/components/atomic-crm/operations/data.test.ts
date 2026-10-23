import { describe, expect, it, vi } from "vitest";
import { testDataProvider } from "ra-core";
import {
  businessReport,
  loadSnapshot,
  makeBackup,
  qualityIssues,
  readAll,
  resources,
  validateBackup,
  type Snapshot,
} from "./data";

const empty = (): Snapshot =>
  Object.fromEntries(resources.map((r) => [r, []])) as unknown as Snapshot;

describe("complete business snapshots", () => {
  it("reads all returned pages until the declared total is reached", async () => {
    const getList = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], total: 3 })
      .mockResolvedValueOnce({ data: [{ id: 3 }], total: 3 });
    expect(
      await readAll(testDataProvider({ getList }), "companies"),
    ).toHaveLength(3);
    expect(getList.mock.calls[1][1].pagination.page).toBe(2);
  });
  it("rejects missing rows rather than reporting a complete backup", async () => {
    const getList = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 })
      .mockResolvedValueOnce({ data: [], total: 2 });
    await expect(
      readAll(testDataProvider({ getList }), "companies"),
    ).rejects.toThrow("未完整加载");
  });
  it("rejects changing totals and duplicate page rows", async () => {
    for (const response of [
      { data: [{ id: 2 }], total: 3 },
      { data: [{ id: 1 }], total: 2 },
    ]) {
      const getList = vi
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 })
        .mockResolvedValueOnce(response);
      await expect(
        readAll(testDataProvider({ getList }), "companies"),
      ).rejects.toThrow();
    }
  });
  it("excludes team passwords and auth identifiers", async () => {
    const getList = vi.fn().mockResolvedValue({
      data: [
        { id: 1, first_name: "A", password: "secret", user_id: "auth-id" },
      ],
      total: 1,
    });
    const data = await loadSnapshot(testDataProvider({ getList }));
    expect(data.sales[0]).not.toHaveProperty("password");
    expect(data.sales[0]).not.toHaveProperty("user_id");
  });
  it("validates an intact backup and rejects modified records and wrong versions", async () => {
    const data = empty();
    data.companies = [{ id: 1, name: "Original" }];
    const backup = await makeBackup(data, new Date().toISOString());
    expect(
      (await validateBackup(JSON.parse(JSON.stringify(backup)))).companies,
    ).toBe(1);
    await expect(validateBackup({ ...backup, version: 2 })).rejects.toThrow(
      "版本",
    );
    backup.data.companies[0].name = "Changed";
    await expect(validateBackup(backup)).rejects.toThrow("校验失败");
  });
});

describe("data quality", () => {
  it("normalizes duplicate names and emails without treating blank names or repeated emails within one contact as duplicates", () => {
    const data = empty();
    data.companies = [
      { id: 1, name: " Acme " },
      { id: 2, name: "ACME" },
      { id: 3, name: "" },
      { id: 4, name: "" },
    ];
    data.contacts = [
      {
        id: 1,
        email_jsonb: [{ email: " A@EXAMPLE.COM " }, { email: "a@example.com" }],
      },
      { id: 2, email_jsonb: [{ email: "a@example.com" }] },
    ];
    const issues = qualityIssues(data);
    expect(issues.filter((i) => i.kind === "疑似重复公司")).toHaveLength(2);
    expect(issues.filter((i) => i.kind === "重复联系人邮箱")).toHaveLength(2);
  });
  it("uses contact channels and open linked tasks, including numeric/string IDs", () => {
    const data = empty();
    data.sales = [{ id: 1, disabled: false }];
    data.companies = [{ id: 1, name: "A", country: "CN", sales_id: "1" }];
    data.contacts = [
      { id: 5, company_id: "1", email_jsonb: [{ email: "a@example.com" }] },
    ];
    data.recruitment = [{ id: 2, company_id: 1, status: "confirmed" }];
    data.tasks = [{ id: 3, contact_id: 5, done_date: "2026-01-01" }];
    expect(qualityIssues(data).map((i) => i.kind)).toEqual(["缺少下次跟进"]);
    data.tasks.push({ id: 4, recruitment_id: "2", done_date: null });
    expect(qualityIssues(data)).toEqual([]);
  });
});

describe("business reporting", () => {
  it("applies date boundaries and owner attribution while keeping current-state metrics independent of dates", () => {
    const data = empty();
    data.companies = [
      { id: 1, sales_id: 1, created_at: "2026-10-01T00:00:00Z" },
      { id: 2, sales_id: 2, created_at: "2026-10-02T00:00:00Z" },
      { id: 3, sales_id: 1, created_at: "2026-11-01T00:00:00Z" },
    ];
    data.recruitment = [
      { id: 1, company_id: 1, created_at: "2026-10-03T00:00:00Z" },
    ];
    data.tasks = [
      { id: 1, sales_id: 1, done_date: "2026-10-10T00:00:00Z" },
      { id: 2, sales_id: 1, done_date: null, due_date: "2026-09-01" },
    ];
    data.deals = [
      { id: 1, sales_id: 1, company_id: 1, stage: "contacted" },
      { id: 2, sales_id: 1, company_id: "1", stage: "contacted" },
      {
        id: 3,
        sales_id: 1,
        company_id: 2,
        stage: "won",
        archived_at: "2026-10-01",
      },
    ];
    const report = businessReport(
      data,
      new Date("2026-10-01Z"),
      new Date("2026-11-01Z"),
      "1",
      new Date("2026-10-23Z"),
    );
    expect(report).toEqual({
      contactedCompanies: 1,
      repliedCompanies: 0,
      replyRate: 0,
      newCompanies: 1,
      newLeads: 1,
      completedTasks: 1,
      notes: 0,
      pendingTasks: 1,
      overdueTasks: 1,
      stages: { contacted: 1 },
    });
  });
});

it("deduplicates contacted companies across sources and calculates reply rate with an explicit empty denominator", () => {
  const data = empty();
  const dates = [new Date("2026-10-01"), new Date("2026-11-01")];
  expect(businessReport(data, dates[0], dates[1], "").replyRate).toBeNull();
  data.companies = [
    { id: 1, sales_id: 1 },
    { id: 2, sales_id: 1 },
    { id: 3, sales_id: 2 },
  ];
  data.recruitment = [
    { id: 1, company_id: 1, status: "replied" },
    { id: 2, company_id: 2, status: "contacted" },
  ];
  data.deals = [
    { id: 1, company_id: "1", stage: "demo", sales_id: 1 },
    { id: 2, company_id: 3, stage: "won", sales_id: 2 },
    { id: 3, company_id: 4, stage: "lost", sales_id: 1 },
  ];
  const report = businessReport(data, dates[0], dates[1], "1");
  expect(report.contactedCompanies).toBe(2);
  expect(report.repliedCompanies).toBe(1);
  expect(report.replyRate).toBe(0.5);
});
