import type { DataProvider } from "ra-core";
import { getCompanyCounts } from "./companyCounts";

describe("getCompanyCounts", () => {
  it("counts unique companies across all pages and keeps the active filters", async () => {
    const getList = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, id) => ({
          id,
          company_id: 1,
          stage: "contacted",
        })),
        total: 102,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 101, company_id: 2, stage: "contacted" },
          { id: 102, company_id: 1, stage: "replied" },
        ],
        total: 102,
      });
    const filter = { sales_id: 7, "archived_at@is": null };
    expect(
      await getCompanyCounts({ getList } as unknown as DataProvider, filter, [
        "contacted",
        "replied",
        "pending",
      ]),
    ).toEqual({ contacted: 2, replied: 1, pending: 0 });
    expect(getList).toHaveBeenLastCalledWith("deals", {
      pagination: { page: 2, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter,
    });
  });
});
