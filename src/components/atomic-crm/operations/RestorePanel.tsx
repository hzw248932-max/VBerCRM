import { useRef, useState } from "react";
import {
  useAuthProvider,
  useDataProvider,
  useGetIdentity,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { inspectRestore, restoreBackup, restoreOrder } from "./restore";

export const RestorePanel = () => {
  const provider = useDataProvider();
  const auth = useAuthProvider();
  const { identity } = useGetIdentity();
  const refresh = useRefresh();
  const [backup, setBackup] = useState<unknown>(null);
  const [preview, setPreview] = useState<{ resource: string; count: number }[]>(
    [],
  );
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const uploadVersion = useRef(0);
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">校验与恢复业务备份</h3>
      <p>
        仅支持恢复到空业务库（含标签表），不会覆盖或删除已有记录。请选择测试环境先演练，并暂停其他人员写入。恢复不是数据库事务，中途失败可能留下部分记录。
      </p>
      <p className="text-sm text-muted-foreground">
        将重新生成记录编号并重建关联；所有业务负责人统一指定为当前管理员{" "}
        {identity?.fullName}
        。不创建账号、不恢复附件文件。最近联系时间和商机更新时间由系统重新计算。
      </p>
      <input
        aria-label="选择恢复备份"
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={async (e) => {
          const version = ++uploadVersion.current;
          const file = e.target.files?.[0];
          e.target.value = "";
          setBackup(null);
          setPreview([]);
          setConfirmation("");
          setMessage("");
          if (!file) return;
          try {
            if (file.size > 50 * 1024 * 1024)
              throw new Error("请选择小于 50 MB 的文件。");
            const value: unknown = JSON.parse(await file.text());
            const data = await inspectRestore(value);
            if (version !== uploadVersion.current) return;
            setBackup(value);
            setPreview(
              restoreOrder.map((resource) => ({
                resource,
                count: data[resource].length,
              })),
            );
            setMessage("文件与关联检查通过。尚未写入数据。");
          } catch (e) {
            if (version === uploadVersion.current)
              setMessage(e instanceof Error ? e.message : "文件检查失败。");
          }
        }}
      />
      {!!preview.length && (
        <>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {preview.map((item) => (
              <li key={item.resource}>
                {item.resource}：{item.count} 条
              </li>
            ))}
          </ul>
          <label className="block">
            确认恢复到当前环境（{window.location.host}）
            <input
              aria-label="恢复确认"
              className="block rounded border p-2"
              placeholder="输入：恢复到空库"
              disabled={busy}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <Button
            disabled={
              busy ||
              confirmation !== "恢复到空库" ||
              identity?.id == null ||
              !preview.some((p) => p.count > 0)
            }
            onClick={async () => {
              if (locked.current || identity?.id == null || !backup) return;
              locked.current = true;
              setBusy(true);
              try {
                const result = await restoreBackup(
                  provider,
                  backup,
                  identity.id,
                  async () =>
                    !!(await auth?.canAccess?.({
                      resource: "sales",
                      action: "list",
                    })),
                  (count) =>
                    setMessage(`正在恢复，已创建 ${count} 条…请勿关闭页面。`),
                );
                setMessage(
                  `恢复并回读验证成功，共 ${result.count} 条记录。请在公司、招聘线索和任务页面验收。`,
                );
                setBackup(null);
                setPreview([]);
                setConfirmation("");
                refresh();
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "恢复失败。");
              } finally {
                locked.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "正在恢复并校验…" : "执行恢复并验证"}
          </Button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
};
