import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { StoryWrapper } from "@/test/StoryWrapper";
import { ForgotPasswordPage } from "./forgot-password-page";

describe("password recovery email", () => {
  it("trims copied whitespace before sending and keeps the callback URL", async () => {
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    const screen = await render(
      <StoryWrapper authProvider={{ resetPassword }}>
        <ForgotPasswordPage />
      </StoryWrapper>,
    );
    await screen
      .getByRole("textbox", { name: /Email|邮箱/ })
      .fill(" 599452835@qq.com ");
    await screen
      .getByRole("button", { name: /Reset password|重置密码/i })
      .click();
    await expect.poll(() => resetPassword.mock.calls.length).toBe(1);
    expect(resetPassword.mock.calls[0][0]).toEqual({
      email: "599452835@qq.com",
      redirectTo: new URL("./auth-callback.html", window.location.href).href,
    });
  });

  it("rejects invalid addresses before calling the mail service", async () => {
    const resetPassword = vi.fn();
    const screen = await render(
      <StoryWrapper authProvider={{ resetPassword }}>
        <ForgotPasswordPage />
      </StoryWrapper>,
    );
    await screen
      .getByRole("textbox", { name: /Email|邮箱/ })
      .fill("599452835＠qq.com");
    await screen
      .getByRole("button", { name: /Reset password|重置密码/i })
      .click();
    await expect
      .element(screen.getByText(/valid email|请输入有效的邮箱地址/))
      .toBeVisible();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
