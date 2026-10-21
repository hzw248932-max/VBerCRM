import { test, expect } from "./fixtures";

test("recruitment links a company and new contact to a persisted follow-up task", async ({
  page,
  createSales,
  createCompany,
  createRecruitment,
  menu,
  isMobile,
}) => {
  const sale = await createSales({
    first_name: "John",
    last_name: "Doe",
    email: "john@doe.com",
    password: "password",
  });
  const company = await createCompany({
    name: "Acceptance Game Studio",
    salesId: sale.id,
  });
  const lead = await createRecruitment(company.id);
  await page.goto("/");
  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("What's next?")).toBeVisible();
  await page.goto(`/#/recruitment/${lead.id}`);
  await expect(
    page.getByRole("button", { name: "创建跟进任务", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "查看公司客户" }).click();
  await expect(
    page.getByText("Acceptance Game Studio", { exact: true }).first(),
  ).toBeVisible();
  if (!isMobile) await page.getByRole("tab", { name: "招聘信号" }).click();
  await page.getByRole("link", { name: "查看 / 编辑招聘信号" }).click();
  await page.getByRole("link", { name: "新增该公司联系人" }).click();
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Last name").fill("Smith");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "编辑招聘信号" }),
  ).toBeVisible();
  const create = page.getByRole("button", {
    name: "创建跟进任务",
    exact: true,
  });
  await expect(create).toBeEnabled();
  await create.click();
  await expect(page.getByLabel("跟进内容")).toHaveValue(/Game UI Designer/);
  await expect(page.getByLabel("跟进内容")).toHaveValue(/bd@example.com/);
  await page.getByLabel("跟进内容").fill("Acceptance follow-up for game UI");
  await page.getByLabel("截止时间").fill("2027-04-11T09:00");
  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/tasks") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存跟进任务" }).click();
  expect((await created).ok()).toBeTruthy();
  await expect(create).toBeDisabled();
  await page.reload();
  await expect(create).toBeDisabled();
  await expect(
    page.getByText("Acceptance follow-up for game UI", { exact: true }),
  ).toBeVisible();
  await menu.goToDashboard();
  await expect(
    page.getByText("Acceptance follow-up for game UI", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看招聘来源 / 安排下次跟进" }).click();
  const completed = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/tasks") &&
      response.request().method() === "PATCH",
  );
  await page
    .getByRole("checkbox", { name: /Acceptance follow-up for game UI/ })
    .click();
  expect((await completed).ok()).toBeTruthy();
  await page.reload();
  await expect(create).toBeEnabled();
});
