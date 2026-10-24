import { describe, it, expect, vi } from "vitest";
import { resolveAccessRecord } from "./resolveAccessRecord";
import { canAccess } from "./canAccess";

describe("nested resource permission checks", () => {
  it.each(["list", "show", "create"])(
    "allows %s of notes with an inherited contact record",
    async (action) => {
      const load = vi.fn();
      const params = {
        action,
        resource: "contact_notes",
        record: { id: 24, sales_id: 5 },
      };
      const record = await resolveAccessRecord(params, load);
      expect(canAccess("user", { ...params, record: record! }, 5)).toBe(true);
      expect(load).not.toHaveBeenCalled();
    },
  );
  it.each(["edit", "update", "delete"])(
    "checks parent ownership for %s",
    async (action) => {
      const load = vi.fn().mockResolvedValue({ sales_id: 1 });
      const params = {
        action,
        resource: "contact_notes",
        record: { id: 8, contact_id: 24, sales_id: 5 },
      };
      const record = await resolveAccessRecord(params, load);
      expect(load).toHaveBeenCalledWith("contacts", 24);
      expect(canAccess("user", { ...params, record: record! }, 5)).toBe(false);
    },
  );
  it("allows the parent owner to edit", async () => {
    const params = {
      action: "edit",
      resource: "recruitment",
      record: { company_id: 42 },
    };
    const record = await resolveAccessRecord(params, async () => ({
      sales_id: 5,
    }));
    expect(canAccess("user", { ...params, record: record! }, 5)).toBe(true);
  });
  it("fails closed when a write target has no parent", async () => {
    expect(
      await resolveAccessRecord(
        { action: "edit", resource: "deal_notes", record: { id: 1 } },
        vi.fn(),
      ),
    ).toBeNull();
  });
});
