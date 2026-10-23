import { RestorePanel } from "./RestorePanel";
import { useMemo, useState } from "react";
import {
  Authenticated,
  useCanAccess,
  useDataProvider,
  useNotify,
  useTranslate,
} from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { addDays, format, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  businessReport,
  loadSnapshot,
  makeBackup,
  qualityIssues,
} from "./data";

export const OperationsPage = () => (
  <Authenticated>
    <OperationsContent />
  </Authenticated>
);

function OperationsContent() {
  const provider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();
  const { canAccess: admin } = useCanAccess({
    resource: "sales",
    action: "list",
  });
  const { dealStages } = useConfigurationContext();
  const [tab, setTab] = useState("quality");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [owner, setOwner] = useState("");
  const [from, setFrom] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState("");
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } =
    useQuery({
      queryKey: ["operations-snapshot"],
      queryFn: () => loadSnapshot(provider),
      retry: false,
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
    });
  const issues = useMemo(() => (data ? qualityIssues(data) : []), [data]);
  const filtered = issues.filter((issue) => !kind || issue.kind === kind);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const shownPage = Math.min(page, pages);
  const validDates = !!from && !!to && from <= to;
  const report =
    data && validDates
      ? businessReport(
          data,
          new Date(`${from}T00:00:00`),
          addDays(new Date(`${to}T00:00:00`), 1),
          owner,
        )
      : null;
  const selectClass = "rounded-md border bg-background px-3 py-2 text-sm";
  const download = async () => {
    if (!admin || busy) return;
    setBusy(true);
    try {
      const startedAt = new Date().toISOString();
      const backup = await makeBackup(await loadSnapshot(provider), startedAt);
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VBerCRM-backup-${format(new Date(), "yyyyMMdd-HHmmss")}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLastBackup(new Date().toLocaleString());
      notify("备份文件已生成，请确认浏览器已保存下载文件。");
    } catch (e) {
      notify(e instanceof Error ? e.message : "备份失败，请重试。", {
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">数据与报表</h1>
          <p className="text-sm text-muted-foreground">
            检查客户资料、保存业务备份、查看团队跟进进展。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">返回工作台</Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["quality", "数据质量"],
          ["backup", "业务备份"],
          ["reports", "业务报表"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={tab === value ? "default" : "outline"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          {isFetching ? "正在读取…" : "刷新数据"}
        </Button>
      </div>
      {isPending ? (
        <p role="status">正在完整读取业务记录，请稍候…</p>
      ) : error ? (
        <p role="alert">读取失败：{error.message}。请点击“刷新数据”重试。</p>
      ) : (
        data && (
          <>
            <p className="text-xs text-muted-foreground">
              数据读取时间：{new Date(dataUpdatedAt).toLocaleString()}
              。修改客户资料后请刷新本页。
            </p>
            {tab === "quality" && (
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <h2 className="text-lg font-semibold">
                    待核对事项（{issues.length}）
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    同一公司可能有多项待办；重复名称只是线索，不代表同一法人。修改与转交仍遵循负责人和管理员权限。
                  </p>
                  <label className="flex items-center gap-2">
                    问题类型
                    <select
                      className={selectClass}
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">全部问题</option>
                      {Array.from(new Set(issues.map((i) => i.kind))).map(
                        (k) => (
                          <option key={k}>{k}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {filtered.length === 0 ? (
                    <p>当前检查范围内未发现待处理事项。</p>
                  ) : (
                    <ul className="divide-y">
                      {filtered
                        .slice((shownPage - 1) * 20, shownPage * 20)
                        .map((issue) => (
                          <li
                            key={issue.id}
                            className="flex items-start justify-between gap-4 py-3"
                          >
                            <div>
                              <p className="font-medium">
                                {issue.name} · {issue.kind}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {issue.detail}
                              </p>
                            </div>
                            <Link
                              className="shrink-0 underline"
                              to={`/${issue.resource}/${encodeURIComponent(issue.recordId)}/show`}
                            >
                              查看处理
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      disabled={shownPage <= 1}
                      onClick={() => setPage(shownPage - 1)}
                    >
                      上一页
                    </Button>
                    <span>
                      第 {shownPage} / {pages} 页，共 {filtered.length} 项
                    </span>
                    <Button
                      variant="outline"
                      disabled={shownPage >= pages}
                      onClick={() => setPage(shownPage + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {tab === "backup" && (
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <h2 className="text-lg font-semibold">下载业务数据备份</h2>
                  <p>
                    包含可访问的公司、联系人、招聘线索、商机、任务、跟进记录、标签，以及负责人的姓名和编号。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    不包含登录账号凭据、附件文件和数据库配置。附件仅保留引用信息。下载前请暂时停止编辑，避免跨表读取期间数据变化。建议每周及批量修改前保存一份。
                  </p>
                  <p className="text-sm">
                    此文件用于业务数据留档，不是完整数据库备份，也不能直接上传到现有导入页面。请使用下方专用恢复入口，先在空测试库中演练。
                  </p>
                  {admin ? (
                    <>
                      <Button disabled={busy} onClick={download}>
                        {busy ? "正在生成完整备份…" : "下载 JSON 备份"}
                      </Button>
                      {lastBackup && (
                        <p role="status">本次会话最近生成：{lastBackup}</p>
                      )}
                      <RestorePanel />
                    </>
                  ) : (
                    <p>请联系管理员生成和校验业务备份。</p>
                  )}
                </CardContent>
              </Card>
            )}
            {tab === "reports" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <label>
                    开始日期{" "}
                    <input
                      aria-label="开始日期"
                      className={selectClass}
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    结束日期{" "}
                    <input
                      aria-label="结束日期"
                      className={selectClass}
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  <label>
                    负责人{" "}
                    <select
                      className={selectClass}
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                    >
                      <option value="">全团队</option>
                      {data.sales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                          {s.disabled ? "（已停用）" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {!validDates ? (
                  <p role="alert">请选择有效日期，开始日期不能晚于结束日期。</p>
                ) : (
                  report && (
                    <>
                      <h2 className="font-semibold">
                        所选日期内的新增与完成情况
                      </h2>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                          ["新增公司", report.newCompanies],
                          ["新增招聘线索", report.newLeads],
                          ["完成跟进任务", report.completedTasks],
                          ["新增跟进记录", report.notes],
                        ].map(([label, value]) => (
                          <Card key={label}>
                            <CardContent className="pt-5">
                              <p className="text-sm text-muted-foreground">
                                {label}
                              </p>
                              <p className="text-3xl font-semibold">{value}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        新增按创建时间、任务完成按完成时间、记录按记录日期统计（本地时区）。招聘线索按所属公司当前负责人归属；其他指标按记录负责人归属。任务数不代表已联系公司数。
                      </p>
                      <h2 className="font-semibold">
                        当前状态（不受日期范围限制）
                      </h2>
                      <p>
                        已联系公司 <strong>{report.contactedCompanies}</strong>{" "}
                        家，已回复公司{" "}
                        <strong>{report.repliedCompanies}</strong> 家，回复率{" "}
                        <strong>
                          {report.replyRate == null
                            ? "暂无数据"
                            : (report.replyRate * 100).toFixed(1) + "%"}
                        </strong>
                        。
                      </p>
                      <p className="text-sm text-muted-foreground">
                        按公司编号跨招聘线索和未归档商机去重。联系包含已联系、已回复、已约演示、试用中和已成交；回复包含已回复及上述后续阶段。回复率
                        = 已回复公司 ÷
                        已联系公司。流失或延期本身不推断已联系；当前状态统计不代表历史联系总数或期间回复率。
                      </p>
                      <p>
                        待跟进任务 <strong>{report.pendingTasks}</strong>{" "}
                        条，其中逾期{" "}
                        <strong className="text-destructive">
                          {report.overdueTasks}
                        </strong>{" "}
                        条。
                      </p>
                      <Card>
                        <CardContent className="space-y-4 pt-6">
                          <h3 className="font-semibold">
                            各商机阶段的公司数量
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            同一阶段按公司去重，排除已归档商机；同一公司在不同阶段可分别计数。此图展示当前分布，不是历史转化率。
                          </p>
                          {Array.from(
                            new Set([
                              ...dealStages.map((s) => s.value),
                              ...Object.keys(report.stages),
                            ]),
                          ).map((stage) => {
                            const count = report.stages[stage] ?? 0;
                            const config = dealStages.find(
                              (s) => s.value === stage,
                            );
                            const label = config
                              ? translate(config.label, { _: config.label })
                              : stage;
                            return (
                              <div key={stage}>
                                <div className="flex justify-between text-sm">
                                  <span>{label}</span>
                                  <span>{count} 家</span>
                                </div>
                                <div className="mt-1 h-3 rounded bg-muted">
                                  <div
                                    className="h-3 rounded bg-primary"
                                    style={{
                                      width: `${(count / Math.max(1, ...Object.values(report.stages))) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </>
                  )
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
