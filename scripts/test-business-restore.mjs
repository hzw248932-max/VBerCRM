// Isolated PostgreSQL restore drill; never connects to a Supabase project.
// Uses the same test-only PGlite runtime as test-team-permissions.mjs.
import { PGlite } from "../node_modules/.cache/permissions-db/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const dir = resolve("node_modules/.cache/restore-drill");
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/package.json`, '{"type":"module"}');
for (const module of ["data", "restore"]) {
  const source = readFileSync(
    `src/components/atomic-crm/operations/${module}.ts`,
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  writeFileSync(
    `${dir}/${module}.js`,
    output
      .replaceAll('"./data"', '"./data.js"')
      .replaceAll('"lodash/isEqual"', '"lodash/isEqual.js"'),
  );
}
const { makeBackup, resources } = await import(
  pathToFileURL(`${dir}/data.js`).href
);
const { restoreBackup } = await import(pathToFileURL(`${dir}/restore.js`).href);
const db = new PGlite();
try {
  // Actual application table declarations, with the optional citext extension
  // represented as text in this isolated runtime. Auth/RLS has its own suite.
  const schema = readFileSync("supabase/schemas/01_tables.sql", "utf8");
  const tables = [...schema.matchAll(/create table public\.[\s\S]*?\n\);/g)]
    .map((m) => m[0])
    .join("\n")
    .replaceAll("extensions.citext", "text");
  await db.exec(tables);
  const recruitment = readFileSync(
    "supabase/schemas/10_recruitment.sql",
    "utf8",
  );
  await db.exec(
    recruitment.slice(
      recruitment.indexOf("create table"),
      recruitment.indexOf("alter table public.recruitment enable"),
    ),
  );
  await db.exec(
    "alter table tasks add column recruitment_id bigint references recruitment(id);",
  );
  for (const constraint of schema.matchAll(
    /alter table public\.(companies|contacts|tasks|deals|contact_notes|deal_notes)[\s\S]*?;/g,
  ))
    await db.exec(constraint[0]);
  await db.exec(
    "insert into sales(id,email,administrator,user_id) values (99,'restore@example.test',true,'00000000-0000-0000-0000-000000000099');",
  );
  const columns = await db.query(
    "select table_name,column_name,data_type,udt_name from information_schema.columns where table_schema='public'",
  );
  const allowed = new Set(resources);
  const table = (resource) => {
    assert(allowed.has(resource));
    return `"${resource}"`;
  };
  const provider = {
    async getList(resource, { pagination }) {
      const { rows } = await db.query(
        `select * from ${table(resource)} order by id limit $1 offset $2`,
        [pagination.perPage, (pagination.page - 1) * pagination.perPage],
      );
      const count = await db.query(
        `select count(*)::int as total from ${table(resource)}`,
      );
      return { data: rows, total: count.rows[0].total };
    },
    async getOne(resource, { id }) {
      const result = await db.query(
        `select * from ${table(resource)} where id=$1`,
        [id],
      );
      assert.equal(result.rows.length, 1);
      return { data: result.rows[0] };
    },
    async create(resource, { data }) {
      const keys = Object.keys(data);
      const values = keys.map((key) => {
        const column = columns.rows.find(
          (c) => c.table_name === resource && c.column_name === key,
        );
        assert(column);
        if (data[key] == null) return null;
        if (["json", "jsonb"].includes(column.data_type))
          return JSON.stringify(data[key]);
        if (column.udt_name === "_jsonb")
          return data[key].map((value) => JSON.stringify(value));
        return data[key];
      });
      const result = await db.query(
        `insert into ${table(resource)} (${keys.map((k) => `"${k}"`).join(",")}) values (${values.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
        values,
      );
      return { data: result.rows[0] };
    },
  };
  const source = {
    sales: [{ id: 7 }],
    tags: [{ id: 100, name: "Demo", color: "#ffffff" }],
    companies: [
      {
        id: 101,
        name: "Restore drill",
        country: "中国",
        email: "test@example.test",
        sales_id: 7,
        created_at: "2026-10-01T00:00:00Z",
      },
    ],
    contacts: [
      {
        id: 102,
        company_id: 101,
        first_name: "Test",
        tags: [100],
        email_jsonb: [{ email: "test@example.test", type: "Work" }],
        sales_id: 7,
      },
    ],
    recruitment: [
      {
        id: 103,
        company_id: 101,
        status: "confirmed",
        jobs: [
          {
            title: "UI Designer",
            url: "https://example.test/job",
            keywords: "UI",
          },
        ],
        email_verified: false,
      },
    ],
    deals: [
      {
        id: 104,
        company_id: 101,
        contact_ids: [102],
        name: "Test opportunity",
        stage: "contacted",
        sales_id: 7,
        amount: 100,
      },
    ],
    tasks: [
      {
        id: 105,
        contact_id: 102,
        recruitment_id: 103,
        text: "Follow up",
        due_date: "2026-10-26T09:00:00Z",
        done_date: null,
        sales_id: 7,
      },
    ],
    contact_notes: [
      {
        id: 106,
        contact_id: 102,
        text: "Contact note",
        sales_id: 7,
        attachments: [],
      },
    ],
    deal_notes: [{ id: 107, deal_id: 104, text: "Deal note", sales_id: 7 }],
  };
  const backup = await makeBackup(source, new Date().toISOString());
  const result = await restoreBackup(provider, backup, 99, async () => true);
  assert.equal(result.count, 8);
  const joined = await db.query(
    "select c.name, t.text, d.contact_ids, p.tags from tasks t join contacts p on p.id=t.contact_id join companies c on c.id=p.company_id join recruitment r on r.id=t.recruitment_id join deals d on d.company_id=c.id",
  );
  assert.equal(joined.rows.length, 1);
  assert.equal(joined.rows[0].name, "Restore drill");
  await assert.rejects(
    () => restoreBackup(provider, backup, 99, async () => true),
    /不是空表/,
  );
  console.warn(
    "PASS: actual PostgreSQL tables restored, 8 records read back, relationships joined, repeat restore blocked.",
  );
} finally {
  await db.close();
}
