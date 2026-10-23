import { render } from "vitest-browser-react";
import { act, useState } from "react";
import { RecordContextProvider, ResourceContextProvider } from "ra-core";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { AddTask } from "./AddTask";
import { TaskCreateSheet } from "./TaskCreateSheet";

it.each([false, true])(
  "preserves task drafts across parent refresh (mobile=%s)",
  async (mobile) => {
    const contact = buildContact();
    let refresh: () => void = () => {};
    const Harness = () => {
      const [revision, setRevision] = useState(0);
      const [open, setOpen] = useState(true);
      refresh = () => setRevision((value) => value + 1);
      return (
        <ResourceContextProvider value="contacts">
          <RecordContextProvider value={contact}>
            <span>Revision {revision}</span>
            {mobile ? (
              <TaskCreateSheet
                open={open}
                onOpenChange={setOpen}
                contact_id={contact.id}
              />
            ) : (
              <AddTask />
            )}
          </RecordContextProvider>
        </ResourceContextProvider>
      );
    };
    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <Harness />
      </StoryWrapper>,
    );
    if (!mobile)
      await screen.getByRole("button", { name: /add task/i }).click();
    const description = screen.getByLabelText(/description/i);
    await description.fill("Keep this follow-up draft");
    await act(async () => refresh());
    await expect.element(description).toHaveValue("Keep this follow-up draft");
    await screen.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .element(screen.getByText("Task added", { exact: true }))
      .toBeVisible();
  },
);
