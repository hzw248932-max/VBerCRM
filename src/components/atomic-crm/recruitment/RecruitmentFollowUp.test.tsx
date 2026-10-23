import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { useDataProvider, type DataProvider } from "ra-core";
import { StoryWrapper, buildCompany, buildContact } from "@/test/StoryWrapper";
import { RecruitmentFollowUp } from "./RecruitmentFollowUp";
import type { Recruitment } from "./model";
import { followUpText } from "./followUp";

const record: Recruitment = {
  id: 1,
  company_id: 1,
  jobs: [
    { title: "游戏 UI", url: "https://example.com/jobs/1", keywords: "图标" },
  ],
  status: "confirmed",
  email_verified: false,
};
describe("recruitment follow-up screen", () => {
  it("creates a linked task, blocks a second task, and allows the next follow-up after completion", async () => {
    let provider: DataProvider;
    const Listener = () => {
      provider = useDataProvider();
      return null;
    };
    const screen = await render(
      <StoryWrapper
        data={{
          companies: [buildCompany()],
          contacts: [buildContact({ company_id: 1 })],
          recruitment: [record],
        }}
      >
        <RecruitmentFollowUp record={record} />
        <Listener />
      </StoryWrapper>,
    );
    const create = screen.getByRole("button", {
      name: "创建跟进任务",
      exact: true,
    });
    await expect.element(create).toBeEnabled();
    await create.click();
    await expect
      .element(screen.getByRole("textbox", { name: "跟进内容" }))
      .toHaveValue(followUpText(record));
    await screen
      .getByRole("textbox", { name: "截止时间" })
      .fill("2026-10-22T09:00");
    await screen.getByRole("button", { name: "保存跟进任务" }).click();
    await expect.element(create).toBeDisabled();
    await expect
      .element(screen.getByText("已有未完成任务，完成后可安排下一次跟进。"))
      .toBeVisible();
    const { data } = await provider!.getList("tasks", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(data).toHaveLength(1);
    expect(String(data[0].contact_id)).toBe("1");
    expect(data[0].recruitment_id).toBe(1);
    expect(data[0].sales_id).toBe(0);
    await screen
      .getByRole("checkbox", { name: followUpText(record), exact: true })
      .click();
    await expect.element(create).toBeEnabled();
    const { data: lead } = await provider!.getOne("recruitment", { id: 1 });
    expect(lead.status).toBe("confirmed");
  });
  it("requires a contact belonging to the company and offers contact creation", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          companies: [buildCompany()],
          contacts: [buildContact({ company_id: 2 })],
          recruitment: [record],
        }}
      >
        <RecruitmentFollowUp record={record} />
      </StoryWrapper>,
    );
    await expect
      .element(
        screen.getByText(
          "该公司还没有联系人，请先新增联系人，再创建跟进任务。",
        ),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("button", { name: "创建跟进任务", exact: true }),
      )
      .toBeDisabled();
    await expect
      .element(screen.getByRole("link", { name: "新增该公司联系人" }))
      .toHaveAttribute("href", "/contacts/create");
  });
  it("returns to the recruitment record after creating its company contact", async () => {
    const screen = await render(
      <StoryWrapper
        data={{ companies: [buildCompany()], recruitment: [record] }}
      >
        <RecruitmentFollowUp record={record} />
      </StoryWrapper>,
    );
    await screen.getByRole("link", { name: "新增该公司联系人" }).click();
    await screen.getByRole("textbox", { name: /first name/i }).fill("Grace");
    await screen.getByRole("textbox", { name: /last name/i }).fill("Hopper");
    await screen.getByRole("button", { name: /^save$/i }).click();
    await expect
      .element(screen.getByRole("heading", { name: "编辑招聘信号" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("button", { name: "创建跟进任务", exact: true }),
      )
      .toBeEnabled();
  });
});
