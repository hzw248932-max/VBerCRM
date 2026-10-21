import { describe, expect, it, vi } from "vitest";
import type { DataProvider } from "ra-core";
import { createRecruitmentTask, followUpText } from "./followUp";
import type { Recruitment } from "./model";

const recruitment: Recruitment = {
  id: 9,
  company_id: 3,
  status: "confirmed",
  email_verified: false,
  business_email: "hello@example.com",
  jobs: [
    { title: "游戏 UI", url: "https://example.com/job", keywords: "换皮" },
  ],
};
const values = {
  contact_id: 7,
  sales_id: 1,
  text: "确认设计需求",
  due_date: "2026-10-22T09:00:00+08:00",
  type: "Email",
};
const mockProvider = () => ({
  getOne: vi.fn().mockResolvedValue({ data: { id: 7, company_id: 3 } }),
  getList: vi.fn().mockResolvedValue({ data: [] }),
  create: vi.fn().mockResolvedValue({ data: { id: 12 } }),
});

describe("recruitment follow-up", () => {
  it("creates an assigned task linked to the existing contact and recruitment", async () => {
    const provider = mockProvider();
    await createRecruitmentTask(
      provider as unknown as DataProvider,
      recruitment,
      values,
    );
    expect(provider.create).toHaveBeenCalledWith("tasks", {
      data: {
        ...values,
        due_date: "2026-10-22T01:00:00.000Z",
        recruitment_id: 9,
        done_date: null,
      },
    });
  });
  it("rejects a contact from another company before creating anything", async () => {
    const provider = mockProvider();
    provider.getOne.mockResolvedValue({ data: { id: 7, company_id: 8 } });
    await expect(
      createRecruitmentTask(
        provider as unknown as DataProvider,
        recruitment,
        values,
      ),
    ).rejects.toThrow("该公司");
    expect(provider.create).not.toHaveBeenCalled();
  });
  it("blocks a retry when an unfinished task already exists", async () => {
    const provider = mockProvider();
    provider.getList.mockResolvedValue({ data: [{ id: 12 }] });
    await expect(
      createRecruitmentTask(
        provider as unknown as DataProvider,
        recruitment,
        values,
      ),
    ).rejects.toThrow("未完成");
    expect(provider.create).not.toHaveBeenCalled();
    expect(provider.getList).toHaveBeenCalledWith(
      "tasks",
      expect.objectContaining({
        filter: { recruitment_id: 9, "done_date@is": null },
      }),
    );
  });
  it.each([{ text: "  " }, { due_date: "invalid" }, { type: "" }])(
    "rejects invalid input %s",
    async (invalid) => {
      const provider = mockProvider();
      await expect(
        createRecruitmentTask(
          provider as unknown as DataProvider,
          recruitment,
          { ...values, ...invalid },
        ),
      ).rejects.toThrow("请填写");
      expect(provider.create).not.toHaveBeenCalled();
    },
  );
  it("preserves failures so the form can be retried without updating the lead status", async () => {
    const provider = mockProvider();
    provider.create.mockRejectedValue(new Error("network error"));
    await expect(
      createRecruitmentTask(
        provider as unknown as DataProvider,
        recruitment,
        values,
      ),
    ).rejects.toThrow("network error");
    expect(recruitment.status).toBe("confirmed");
  });
  it("distinguishes unverified contact details from facts and keeps job evidence", () => {
    const text = followUpText(recruitment);
    expect(text).toContain("尚未核实");
    expect(text).toContain("https://example.com/job");
    expect(text).toContain("工作痛点（分析）");
  });
});
