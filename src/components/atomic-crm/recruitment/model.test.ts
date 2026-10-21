import { describe, expect, it } from "vitest";
import {
  safeUrl,
  validateRecruitment as validate,
  validateUrl,
  type Recruitment,
} from "./model";
const validateRecruitment = (values: Partial<Recruitment>) =>
  validate({ company_id: 1, status: "research", ...values });

describe("recruitment qualification", () => {
  it("requires company and validates nested job evidence", () => {
    expect(validate({}).company_id).toBeTruthy();
    expect(
      validateRecruitment({
        jobs: [{ title: "", url: "javascript:alert(1)", keywords: "" }],
      }).jobs,
    ).toEqual([
      { title: "请填写招聘岗位", url: "请输入完整的 http:// 或 https:// 链接" },
    ]);
  });
  it("permits an unscored research record", () => {
    expect(validateRecruitment({ score: null, email_verified: false })).toEqual(
      {},
    );
  });
  it.each([0, 6, 2.5, NaN])("rejects invalid score %s", (score) => {
    expect(validateRecruitment({ score }).score).toBeTruthy();
  });
  it.each([1, 3, 5])("accepts score %s", (score) => {
    expect(validateRecruitment({ score })).toEqual({});
  });
  it("requires both an email and evidence before marking verified", () => {
    expect(
      validateRecruitment({
        email_verified: true,
        business_email: "hello@example.com",
        email_source: " ",
      }).email_source,
    ).toBeTruthy();
    expect(
      validateRecruitment({
        email_verified: true,
        business_email: "hello@example.com",
        email_source: "https://example.com/contact",
      }),
    ).toEqual({});
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///secret",
    "example.com",
  ])("does not render unsafe link %s", (value) => {
    expect(safeUrl(value)).toBeUndefined();
    expect(validateUrl(value)).toBeTruthy();
  });
  it("supports public web links and optional blank URLs", () => {
    expect(safeUrl("https://example.com/jobs")).toBe(
      "https://example.com/jobs",
    );
    expect(validateUrl("")).toBeUndefined();
  });
});
