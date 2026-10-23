import { render } from "vitest-browser-react";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { TasksListByDueDate } from "./TasksListByDueDate";

const task = (id: number, done_date: string | null = null) => ({
  id,
  text: "Follow-up " + id,
  due_date: "2025-01-01T09:00:00Z",
  done_date,
  contact_id: 1,
  sales_id: 0,
  type: "none",
});
it("keeps completed history accessible when no pending tasks remain", async () => {
  const screen = await render(
    <StoryWrapper
      data={{
        contacts: [buildContact()],
        tasks: [task(1, "2025-01-02T09:00:00Z")],
      }}
    >
      <TasksListByDueDate
        filterByContact={1}
        emptyPlaceholder={<p>No pending</p>}
      />
    </StoryWrapper>,
  );
  await expect.element(screen.getByText("No pending")).toBeVisible();
  await screen.getByRole("button", { name: "Completed", exact: true }).click();
  await expect
    .element(screen.getByText("Follow-up 1", { exact: true }))
    .toBeVisible();
  await screen.getByRole("button", { name: "Pending", exact: true }).click();
  await expect.element(screen.getByText("No pending")).toBeVisible();
});
it("moves a checked task into completed history and allows reopening", async () => {
  const screen = await render(
    <StoryWrapper data={{ contacts: [buildContact()], tasks: [task(2)] }}>
      <TasksListByDueDate
        filterByContact={1}
        emptyPlaceholder={<p>No pending</p>}
      />
    </StoryWrapper>,
  );
  await screen.getByRole("checkbox", { name: "Follow-up 2" }).click();
  await expect.element(screen.getByText("No pending")).toBeVisible();
  await screen.getByRole("button", { name: "Completed", exact: true }).click();
  await expect
    .element(screen.getByRole("checkbox", { name: "Follow-up 2" }))
    .toBeChecked();
  await screen.getByRole("checkbox", { name: "Follow-up 2" }).click();
  await expect
    .element(screen.getByText("No completed follow-ups yet"))
    .toBeVisible();
  await screen.getByRole("button", { name: "Pending", exact: true }).click();
  await expect
    .element(screen.getByRole("checkbox", { name: "Follow-up 2" }))
    .not.toBeChecked();
});

it("loads beyond the first hundred tasks without reporting a false total", async () => {
  const screen = await render(
    <StoryWrapper
      data={{
        contacts: [buildContact()],
        tasks: Array.from({ length: 101 }, (_, i) => task(i + 1)),
      }}
    >
      <TasksListByDueDate filterByContact={1} />
    </StoryWrapper>,
  );
  await expect.element(screen.getByText("Showing 100 of 101")).toBeVisible();
  await screen.getByRole("button", { name: "Load more", exact: true }).click();
  await expect.element(screen.getByText("Showing 101 of 101")).toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Load more", exact: true }))
    .not.toBeInTheDocument();
});
