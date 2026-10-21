import { test, expect } from "@playwright/test";

test("email preview does not verify until the recipient continues", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(
    "https://frrmrjfadztokldhyvxe.supabase.co/**",
    async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "Verification requested",
      });
    },
  );
  const token = "a".repeat(64);
  await page.goto(`/email-confirmation.html#token_hash=${token}&type=invite`);
  await expect(
    page.getByRole("button", { name: "继续设置密码" }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "继续设置密码" }).click();
  await expect(page).toHaveURL(/supabase\.co\/auth\/v1\/verify/);
  expect(requests).toHaveLength(1);
  const url = new URL(requests[0]);
  expect(url.searchParams.get("token")).toBe(token);
  expect(url.searchParams.get("type")).toBe("invite");
  expect(url.searchParams.get("redirect_to")).toBe(
    new URL("/auth-callback.html", test.info().project.use.baseURL).href,
  );
});

test("invalid email links cannot start verification", async ({ page }) => {
  await page.goto("/email-confirmation.html#token_hash=invalid&type=invite");
  await expect(
    page.getByText("邮件链接不完整", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "继续设置密码" })).toBeHidden();
});
