import type { Identifier, RaRecord } from "ra-core";

export type Recruitment = RaRecord & {
  company_id: Identifier;
  jobs: { title: string; url: string; keywords: string }[];
  pain_points?: string;
  matched_features?: string;
  score?: number | null;
  business_email?: string;
  email_source?: string;
  email_verified: boolean;
  status: string;
};

export const statuses = [
  { id: "research", name: "待研究" },
  { id: "confirmed", name: "已确认" },
  { id: "contacted", name: "已联系" },
  { id: "replied", name: "已回复" },
];

export const safeUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};

export const validateUrl = (value?: string) =>
  value && !safeUrl(value)
    ? "请输入完整的 http:// 或 https:// 链接"
    : undefined;

export const validateRecruitment = (values: Partial<Recruitment>) => {
  const errors: Record<string, unknown> = {};
  if (!values.company_id) errors.company_id = "请选择公司";
  if (!statuses.some((status) => status.id === values.status))
    errors.status = "请选择推广状态";
  if (
    values.business_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.business_email)
  )
    errors.business_email = "请输入有效的邮箱地址";
  if (validateUrl(values.email_source))
    errors.email_source = validateUrl(values.email_source);
  const jobs = (values.jobs ?? []).map((job) => ({
    ...(!job.title?.trim() ? { title: "请填写招聘岗位" } : {}),
    ...(!job.url?.trim()
      ? { url: "请填写职位链接" }
      : validateUrl(job.url)
        ? { url: validateUrl(job.url) }
        : {}),
  }));
  if (jobs.some((job) => Object.keys(job).length)) errors.jobs = jobs;
  if (
    values.email_verified &&
    (!values.business_email?.trim() || !values.email_source?.trim())
  ) {
    errors.email_source = "标记为已核实时，请填写商务邮箱和公开来源链接";
  }
  if (
    values.score != null &&
    (!Number.isInteger(values.score) || values.score < 1 || values.score > 5)
  ) {
    errors.score = "评分必须为 1–5 的整数";
  }
  return errors;
};
