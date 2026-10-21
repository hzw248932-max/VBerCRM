import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { Dashboard } from "./Dashboard";
import { MobileDashboard } from "./MobileDashboard";

describe("follow-up visibility before the first contact note", () => {
  for (const [name, Component] of [
    ["desktop", Dashboard],
    ["mobile", MobileDashboard],
  ] as const) {
    it(`shows the assigned recruitment task on ${name}`, async () => {
      const screen = await render(
        <StoryWrapper
          data={{
            contacts: [buildContact()],
            tasks: [
              {
                id: 1,
                contact_id: 1,
                sales_id: 0,
                recruitment_id: 7,
                text: "Follow up on UI hiring",
                type: "none",
                due_date: "2027-04-11T09:00:00Z",
              },
            ],
          }}
        >
          <Component />
        </StoryWrapper>,
      );
      await expect
        .element(screen.getByText("Follow up on UI hiring", { exact: true }))
        .toBeVisible();
      await expect
        .element(
          screen.getByRole("link", { name: "查看招聘来源 / 安排下次跟进" }),
        )
        .toHaveAttribute("href", "/recruitment/7");
    });
  }
});
