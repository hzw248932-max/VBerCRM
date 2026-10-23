import { canAccess } from "./canAccess";

describe("shared team permissions", () => {
  it.each([
    "companies",
    "contacts",
    "deals",
    "tasks",
    "recruitment",
    "contact_notes",
    "deal_notes",
  ])("allows shared reads and owner/admin edits for %s", (resource) => {
    expect(
      canAccess(
        "user",
        { resource, action: "show", record: { sales_id: 2 } },
        1,
      ),
    ).toBe(true);
    for (const action of ["edit", "update", "delete"]) {
      expect(
        canAccess("user", { resource, action, record: { sales_id: 2 } }, 1),
      ).toBe(false);
      expect(
        canAccess("user", { resource, action, record: { sales_id: "1" } }, 1),
      ).toBe(true);
      expect(
        canAccess("user", { resource, action, record: { sales_id: null } }, 1),
      ).toBe(false);
      expect(
        canAccess("admin", { resource, action, record: { sales_id: 2 } }, 1),
      ).toBe(true);
    }
  });
  it("restricts team management and assignments to administrators", () => {
    expect(canAccess("user", { resource: "sales", action: "list" }, 1)).toBe(
      false,
    );
    expect(canAccess("user", { resource: "tasks", action: "assign" }, 1)).toBe(
      false,
    );
    expect(canAccess("admin", { resource: "tasks", action: "assign" }, 1)).toBe(
      true,
    );
    expect(
      canAccess("unknown", { resource: "companies", action: "edit" }, 1),
    ).toBe(false);
  });
});
