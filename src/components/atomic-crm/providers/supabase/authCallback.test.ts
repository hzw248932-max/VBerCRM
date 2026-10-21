import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeEmailCallback } from "./authCallback";

function setup() {
  const setSession = vi.fn().mockResolvedValue({ error: null });
  return {
    setSession,
    client: { auth: { setSession } } as unknown as SupabaseClient,
  };
}

describe("email callbacks", () => {
  it("explains expired invitations without reporting missing tokens", async () => {
    const { client, setSession } = setup();
    await expect(
      completeEmailCallback(
        client,
        "#/auth-callback?error=access_denied&error_code=otp_expired",
      ),
    ).rejects.toThrow("ra-supabase.auth.email_link_expired");
    expect(setSession).not.toHaveBeenCalled();
  });
  it("establishes a confirmation session and explicitly opens the dashboard", async () => {
    const { client, setSession } = setup();
    expect(
      await completeEmailCallback(
        client,
        "#/auth-callback?access_token=access&refresh_token=refresh&type=signup",
      ),
    ).toEqual({ redirectTo: "/" });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
  });
  it.each(["recovery", "invite"])(
    "preserves the %s password setup flow",
    async (type) => {
      const { client, setSession } = setup();
      const result = await completeEmailCallback(
        client,
        `#/auth-callback?access_token=a%2Bb&refresh_token=r%26x&type=${type}`,
      );
      expect(typeof result.redirectTo).toBe("function");
      if (typeof result.redirectTo === "function") {
        const target = result.redirectTo();
        expect(target.pathname).toBe("/set-password");
        expect(new URLSearchParams(target.search).get("refresh_token")).toBe(
          "r&x",
        );
      }
      expect(setSession).toHaveBeenCalledWith({
        access_token: "a+b",
        refresh_token: "r&x",
      });
    },
  );
  it.each([
    "",
    "?access_token=null&refresh_token=null",
    "?access_token=a",
    "?error_code=otp_expired&access_token=a&refresh_token=b",
  ])("rejects an invalid callback: %s", async (suffix) => {
    const { client, setSession } = setup();
    await expect(
      completeEmailCallback(client, "#/auth-callback" + suffix),
    ).rejects.toThrow();
    expect(setSession).not.toHaveBeenCalled();
  });
  it("does not report success when the session is rejected", async () => {
    const { client, setSession } = setup();
    setSession.mockResolvedValue({ error: new Error("Expired") });
    await expect(
      completeEmailCallback(
        client,
        "#/auth-callback?access_token=a&refresh_token=b",
      ),
    ).rejects.toThrow("Expired");
  });
  it("waits for the recovery session before returning a redirect", async () => {
    const { client, setSession } = setup();
    let finish!: () => void;
    setSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ error: null });
        }),
    );
    const completed = vi.fn();
    const callback = completeEmailCallback(
      client,
      "#/auth-callback?access_token=a&refresh_token=b&type=recovery",
    ).then(completed);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    finish();
    await callback;
    expect(completed).toHaveBeenCalledOnce();
  });
  it.each(["recovery", "invite"])(
    "rejects an expired %s session before redirecting",
    async (type) => {
      const { client, setSession } = setup();
      setSession.mockResolvedValue({ error: new Error("Expired") });
      await expect(
        completeEmailCallback(
          client,
          `#/auth-callback?access_token=a&refresh_token=b&type=${type}`,
        ),
      ).rejects.toThrow("Expired");
    },
  );
});
