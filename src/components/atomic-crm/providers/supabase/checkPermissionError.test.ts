import { describe, it, expect, vi } from "vitest";
import { checkPermissionError } from "./checkPermissionError";

describe("permission failures and sessions", () => {
  it("keeps an active member signed in after a forbidden write", async () => {
    const base = vi.fn().mockRejectedValue(new Error("logout"));
    await checkPermissionError({ status: 403 }, async () => true, base);
    expect(base).not.toHaveBeenCalled();
  });
  it("still rejects disabled members", async () => {
    await expect(
      checkPermissionError(
        { status: 403 },
        async () => false,
        async () => {
          throw new Error("logout");
        },
      ),
    ).rejects.toThrow("logout");
  });
  it("does not suppress expired credentials", async () => {
    const member = vi.fn();
    await expect(
      checkPermissionError({ status: 401 }, member, async () => {
        throw new Error("expired");
      }),
    ).rejects.toThrow("expired");
    expect(member).not.toHaveBeenCalled();
  });
});
