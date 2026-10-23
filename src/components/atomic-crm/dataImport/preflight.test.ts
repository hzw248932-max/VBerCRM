import { expect, it } from "vitest";
import { testDataProvider } from "ra-core";
import { inspectImport, normalizeCountry } from "./preflight";
const provider = testDataProvider({
  getList: async () => ({ data: [], total: 0 }),
});
const csv = (text: string) =>
  new File([text], "import.csv", { type: "text/csv" });
it("rejects duplicate companies across a whole file before batching", async () => {
  const result = await inspectImport(
    csv(
      "name,country,email\nAcme,CN,a@example.com\n ACME ,France,b@example.com",
    ),
    "companies",
    provider,
  );
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain("重复");
});
it("checks existing companies and rejects invalid emails and country cells", async () => {
  const db = testDataProvider({
    getList: async () => ({ data: [{ id: 1, name: "Acme" }] as any, total: 1 }),
  });
  const result = await inspectImport(
    csv("name,country,email\nAcme,123,invalid"),
    "companies",
    db,
  );
  expect(result.errors).toHaveLength(3);
});
it("treats missing country and email as explicit warnings", async () => {
  const result = await inspectImport(
    csv("name,country,email\nAcme,,"),
    "companies",
    provider,
  );
  expect(result.errors).toEqual([]);
  expect(result.warnings).toHaveLength(2);
  expect(normalizeCountry(" CN ")).toBe("中国");
});
it("detects duplicate contact emails but permits the same email in two fields on one contact", async () => {
  const result = await inspectImport(
    csv(
      "first_name,email_work,email_home\nA,a@example.com,a@example.com\nB,A@example.com,",
    ),
    "contacts",
    provider,
  );
  expect(result.errors).toHaveLength(1);
});
it("rejects malformed CSV without querying or writing records", async () => {
  await expect(
    inspectImport(csv('name,email\n"Unclosed'), "companies", provider),
  ).rejects.toThrow("CSV");
});
