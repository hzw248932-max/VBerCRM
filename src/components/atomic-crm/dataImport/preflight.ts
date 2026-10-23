import Papa from "papaparse";
import type { DataProvider } from "ra-core";
import { readAll } from "../operations/data";

export const normalizeCompanyName = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export const normalizeCountry = (value: string) => {
  const text = value.trim();
  return (
    (
      {
        cn: "中国",
        china: "中国",
        us: "美国",
        usa: "美国",
        "united states": "美国",
        fr: "法国",
        france: "法国",
        uk: "英国",
        gb: "英国",
        "united kingdom": "英国",
        jp: "日本",
        japan: "日本",
      } as Record<string, string>
    )[text.toLowerCase()] ?? text
  );
};

export async function inspectImport(
  file: File,
  resource: string,
  provider: DataProvider,
) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("请将 CSV 拆分为小于 10 MB 的文件。");
  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length)
    throw new Error(`CSV 格式有误：${parsed.errors[0].message}`);
  if (!parsed.data.length) throw new Error("CSV 中没有数据。");
  const errors: string[] = [],
    warnings: string[] = [];
  const existing =
    resource === "companies" || resource === "contacts"
      ? await readAll(provider, resource)
      : [];
  const names = new Set(
    existing.map((r) => normalizeCompanyName(r.name ?? "")).filter(Boolean),
  );
  const emails = new Set<string>(
    existing.flatMap((r) =>
      (r.email_jsonb ?? []).map((e: { email: string }) =>
        e.email.trim().toLowerCase(),
      ),
    ),
  );
  parsed.data.forEach((row, index) => {
    const line = `第 ${index + 2} 行`;
    if (resource === "companies") {
      const name = normalizeCompanyName(row.name ?? "");
      if (!name) errors.push(`${line}：公司名称不能为空。`);
      else if (names.has(name))
        errors.push(`${line}：公司名称与已有数据或本文件重复，请核对后处理。`);
      names.add(name);
      const country = (row.country ?? "").trim();
      if (!country) warnings.push(`${line}：未填写国家 / 地区。`);
      else if (
        country.length > 100 ||
        !/\p{L}/u.test(country) ||
        /[@:/\\\d]/.test(country)
      )
        errors.push(
          `${line}：国家 / 地区格式不正确，请填写国家名称或字母代码。`,
        );
      if (!(row.email ?? "").trim()) warnings.push(`${line}：未填写公司邮箱。`);
    }
    const fields =
      resource === "contacts"
        ? ["email_work", "email_home", "email_other"]
        : resource === "companies"
          ? ["email"]
          : [];
    const rowEmails = new Set<string>();
    for (const field of fields) {
      const email = (row[field] ?? "").trim().toLowerCase();
      if (!email) continue;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        errors.push(`${line}：${field} 邮箱格式不正确。`);
      if (resource === "contacts" && emails.has(email))
        errors.push(`${line}：邮箱 ${email} 与其他联系人重复，请先核对。`);
      rowEmails.add(email);
    }
    for (const email of rowEmails) emails.add(email);
    if (resource === "contacts" && !rowEmails.size)
      warnings.push(`${line}：未填写联系人邮箱。`);
  });
  return { rows: parsed.data.length, errors, warnings };
}
