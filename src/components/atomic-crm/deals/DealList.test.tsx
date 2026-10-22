import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import {
  AdminAccountManagerFilter,
  NonAdminAccountManagerFilter,
  PaginatedDeals,
} from "./DealList.stories";

describe("DealList", () => {
  it("paginates cards and keeps the deduplicated company count across pages", async () => {
    const screen = await render(<PaginatedDeals />);
    await expect
      .element(screen.getByText("Acme - Paged deal 26", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Acme - Paged deal 1", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("1 companies", { exact: true }))
      .toBeVisible();
    await screen.getByRole("link", { name: "2", exact: true }).click();
    await expect
      .element(screen.getByText("Acme - Paged deal 1", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Acme - Paged deal 26", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("1 companies", { exact: true }))
      .toBeVisible();
  });
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("lets an admin filter the board by account manager instead of only-mine", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect.element(screen.getByText("Acme - Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Marie deal")).toBeVisible();
    await expect
      .element(screen.getByText("Only deals I manage"))
      .not.toBeInTheDocument();

    await screen.getByRole("combobox", { name: "Account manager" }).click();
    await screen.getByRole("option", { name: "Marie Curie" }).click();

    await expect
      .element(screen.getByText("Acme - Jane deal"))
      .not.toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Clear value" });
    await clearButton.element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByText("Acme - Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Marie deal")).toBeVisible();
  });

  it("keeps the only-mine switch for a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Only deals I manage")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });
});
