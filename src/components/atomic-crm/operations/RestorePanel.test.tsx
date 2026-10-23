import { render } from "vitest-browser-react";
import { StoryWrapper } from "@/test/StoryWrapper";
import { makeBackup, resources, type Snapshot } from "./data";
import { RestorePanel } from "./RestorePanel";

it("previews a backup without writes, requires confirmation, then restores and verifies", async () => {
  const data = Object.fromEntries(
    resources.map((r) => [r, []]),
  ) as unknown as Snapshot;
  data.companies = [{ id: 101, name: "Restore preview" }];
  const backup = await makeBackup(data, new Date().toISOString());
  const screen = await render(
    <StoryWrapper>
      <RestorePanel />
    </StoryWrapper>,
  );
  await screen.getByLabelText("选择恢复备份").upload(
    new File([JSON.stringify(backup)], "backup.json", {
      type: "application/json",
    }),
  );
  await expect
    .element(
      screen.getByText("文件与关联检查通过。尚未写入数据。", { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "执行恢复并验证" }))
    .toBeDisabled();
  await screen.getByLabelText("恢复确认").fill("恢复到空库");
  await screen.getByRole("button", { name: "执行恢复并验证" }).click();
  await expect
    .element(
      screen.getByText(
        "恢复并回读验证成功，共 1 条记录。请在公司、招聘线索和任务页面验收。",
        { exact: true },
      ),
    )
    .toBeVisible();
});
