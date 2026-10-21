import type { DataProvider, Identifier } from "ra-core";
import type { Recruitment } from "./model";
import type { Task } from "../types";

export const followUpText = (record: Recruitment) =>
  [
    "跟进招聘需求，确认是否适合 VBerAI。",
    ...record.jobs.map(
      (job) =>
        `岗位：${job.title}；关键词：${job.keywords || "未填写"}\n${job.url}`,
    ),
    `工作痛点（分析）：${record.pain_points || "待确认"}`,
    `匹配功能：${record.matched_features || "待确认"}`,
    `商务邮箱：${record.business_email || "待查找"}（${record.email_verified ? "已核实公开来源" : "尚未核实"}）`,
    ...(record.email_source ? [`邮箱来源：${record.email_source}`] : []),
  ].join("\n");

export const createRecruitmentTask = async (
  provider: DataProvider,
  recruitment: Recruitment,
  values: {
    contact_id: Identifier;
    sales_id: Identifier;
    text: string;
    due_date: string;
    type: string;
  },
) => {
  if (
    !values.text.trim() ||
    !values.type ||
    !Number.isFinite(Date.parse(values.due_date))
  )
    throw new Error("请填写跟进内容、类型和有效的截止时间。");
  const { data: contact } = await provider.getOne("contacts", {
    id: values.contact_id,
  });
  if (String(contact.company_id) !== String(recruitment.company_id))
    throw new Error("请选择该公司的联系人。");
  const { data: existing } = await provider.getList<Task>("tasks", {
    filter: { recruitment_id: recruitment.id, "done_date@is": null },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "DESC" },
  });
  if (existing.length)
    throw new Error("该线索已有未完成的任务，请先处理现有任务。");
  return provider.create<Task>("tasks", {
    data: {
      ...values,
      text: values.text.trim(),
      due_date: new Date(values.due_date).toISOString(),
      recruitment_id: recruitment.id,
      done_date: null,
    },
  });
};
