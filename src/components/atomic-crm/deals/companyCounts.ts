import type { DataProvider } from "ra-core";
import type { Deal } from "../types";

// Read every matching page: totals must not change when the board changes page.
export const getCompanyCounts = async (
  dataProvider: DataProvider,
  filter: Record<string, unknown>,
  stages: string[],
) => {
  const companies = Object.fromEntries(
    stages.map((stage) => [stage, new Set<string>()]),
  );
  let loaded = 0;
  for (let page = 1; ; page++) {
    const { data, total, pageInfo } = await dataProvider.getList<Deal>(
      "deals",
      {
        pagination: { page, perPage: 100 },
        sort: { field: "id", order: "ASC" },
        filter,
      },
    );
    for (const deal of data) {
      const stage = companies[deal.stage] ? deal.stage : stages[0];
      if (stage && deal.company_id != null)
        companies[stage].add(String(deal.company_id));
    }
    loaded += data.length;
    if (
      !data.length ||
      (total != null && loaded >= total) ||
      pageInfo?.hasNextPage === false ||
      (total == null && !pageInfo && data.length < 100)
    )
      break;
  }
  return Object.fromEntries(
    Object.entries(companies).map(([stage, ids]) => [stage, ids.size]),
  );
};
