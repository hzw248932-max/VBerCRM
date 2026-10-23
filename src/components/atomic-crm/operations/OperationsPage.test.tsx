import { render } from "vitest-browser-react";
import { StoryWrapper, buildCompany, buildContact } from "@/test/StoryWrapper";
import { OperationsPage } from "./OperationsPage";

it("links quality issues to records and exposes reports with date validation", async () => {
  const screen = await render(
    <StoryWrapper
      data={{
        companies: [buildCompany({ country: "", sales_id: 0 })],
        contacts: [buildContact()],
      }}
    >
      <OperationsPage />
    </StoryWrapper>,
  );
  await expect.element(screen.getByText("Acme · 缺少国家")).toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: "查看处理" }).first())
    .toHaveAttribute("href", "/companies/1/show");
  await screen.getByRole("button", { name: "业务报表", exact: true }).click();
  await expect.element(screen.getByText("各商机阶段的公司数量")).toBeVisible();
  await screen.getByLabelText("开始日期", { exact: true }).fill("2026-12-31");
  await screen.getByLabelText("结束日期", { exact: true }).fill("2026-01-01");
  await expect
    .element(
      screen.getByText("请选择有效日期，开始日期不能晚于结束日期。", {
        exact: true,
      }),
    )
    .toBeVisible();
});

it("does not offer backup download to ordinary members", async () => {
  const screen = await render(
    <StoryWrapper
      authProvider={{ canAccess: async ({ resource }) => resource !== "sales" }}
    >
      <OperationsPage />
    </StoryWrapper>,
  );
  await screen.getByRole("button", { name: "业务备份", exact: true }).click();
  await expect
    .element(screen.getByText("请联系管理员生成和校验业务备份。"))
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "下载 JSON 备份" }))
    .not.toBeInTheDocument();
});

it("reports read failures instead of displaying empty or partial statistics", async () => {
  const screen = await render(
    <StoryWrapper
      dataProvider={{
        getList: async () => {
          throw new Error("测试连接失败");
        },
      }}
    >
      <OperationsPage />
    </StoryWrapper>,
  );
  await expect
    .element(
      screen.getByText("读取失败：测试连接失败。请点击“刷新数据”重试。", {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(screen.getByText("新增公司", { exact: true }))
    .not.toBeInTheDocument();
});
