// Isolated PostgreSQL RLS checks. Install the test-only runtime with:
// npm install --prefix node_modules/.cache/permissions-db --no-save --ignore-scripts @electric-sql/pglite
// node scripts/test-team-permissions.mjs
import { PGlite } from "../node_modules/.cache/permissions-db/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
const check = (value, expected) => {
  assert.deepEqual(value, expected);
  checks++;
};
try {
  await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.sales (id bigint primary key, user_id uuid, administrator boolean default false, disabled boolean default false);
create function public.is_admin() returns boolean language sql stable as $$select exists(select 1 from public.sales where user_id=auth.uid() and administrator and disabled is not true)$$;
create table public.companies (id bigint primary key, sales_id bigint references public.sales, name text);
create table public.contacts (id bigint primary key, sales_id bigint references public.sales, company_id bigint references public.companies, name text);
create table public.deals (id bigint primary key, sales_id bigint references public.sales, company_id bigint references public.companies, name text);
create table public.tasks (id bigint primary key, sales_id bigint references public.sales, contact_id bigint references public.contacts, recruitment_id bigint, name text);
create table public.contact_notes (id bigint primary key, contact_id bigint references public.contacts, recruitment_id bigint, name text);
create table public.deal_notes (id bigint primary key, deal_id bigint references public.deals, name text);
create table public.tags (id bigint primary key);
create table public.configuration (id bigint primary key);
create table public.favicons_excluded_domains (id bigint primary key);
create table storage.objects (id bigint primary key, bucket_id text);
create table public.recruitment (id bigint primary key, company_id bigint references public.companies, name text);
`);
  await db.exec(readFileSync("supabase/schemas/05_policies.sql", "utf8"));
  const membership = readFileSync("supabase/schemas/09_membership.sql", "utf8");
  await db.exec(
    membership.slice(membership.indexOf("create schema if not exists")),
  );
  await db.exec(
    `alter table recruitment enable row level security; create policy members on recruitment for all to authenticated using (crm_private.is_active_member()) with check (crm_private.is_active_member()); grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261023064603_team_collaboration_permissions.sql",
      "utf8",
    ),
  );
  const uid = (id) => `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`;
  await db.exec(
    `insert into sales values (1,'${uid(1)}',true,false),(2,'${uid(2)}',false,false),(3,'${uid(3)}',false,false),(4,'${uid(4)}',false,true);`,
  );
  for (const table of ["companies", "contacts", "deals", "tasks"])
    await db.exec(
      `insert into ${table}(id,sales_id,name) values (1,2,'Owner A'),(2,3,'Owner B'),(3,null,'Unassigned');`,
    );
  for (const [table, key] of [
    ["recruitment", "company_id"],
    ["contact_notes", "contact_id"],
    ["deal_notes", "deal_id"],
  ])
    await db.exec(
      `insert into ${table}(id,${key},name) values (1,1,'A'),(2,2,'B');`,
    );
  const asUser = async (id) =>
    db.exec(
      `reset role; set request.jwt.claim.sub = '${uid(id)}'; set role authenticated;`,
    );
  const rows = async (sql) => (await db.query(sql)).rows;
  const denied = async (sql) => {
    let error;
    try {
      await db.exec(sql);
    } catch (e) {
      error = e;
    }
    assert.ok(error, `Expected rejection: ${sql}`);
    assert.ok(["42501", "23514"].includes(error.code), error.message);
    checks++;
  };
  await asUser(2);
  for (const table of ["companies", "contacts", "deals", "tasks"]) {
    check((await rows(`select id from ${table}`)).length, 3);
    check(
      (await rows(`update ${table} set name='mine' where id=1 returning id`))
        .length,
      1,
    );
    check(
      (await rows(`update ${table} set name='attack' where id=2 returning id`))
        .length,
      0,
    );
    check(
      (await rows(`delete from ${table} where id=2 returning id`)).length,
      0,
    );
    await denied(`update ${table} set sales_id=3 where id=1`);
    await denied(`insert into ${table}(id,sales_id) values(99,3)`);
    await denied(`insert into ${table}(id,sales_id) values(99,null)`);
    await db.exec(
      `insert into ${table}(id,sales_id) values(99,2); delete from ${table} where id=99`,
    );
    checks++;
  }
  for (const table of ["recruitment", "contact_notes", "deal_notes"]) {
    check((await rows(`select id from ${table}`)).length, 2);
    check(
      (await rows(`update ${table} set name='mine' where id=1 returning id`))
        .length,
      1,
    );
    check(
      (await rows(`update ${table} set name='attack' where id=2 returning id`))
        .length,
      0,
    );
    check(
      (await rows(`delete from ${table} where id=2 returning id`)).length,
      0,
    );
  }
  await asUser(1);
  for (const table of ["companies", "contacts", "deals", "tasks"]) {
    check(
      (await rows(`update ${table} set sales_id=3 where id=1 returning id`))
        .length,
      1,
    );
    await denied(`update ${table} set sales_id=4 where id=1`);
  }
  await asUser(2);
  check(
    (
      await rows(
        `update companies set name='old owner' where id=1 returning id`,
      )
    ).length,
    0,
  );
  await asUser(3);
  check(
    (
      await rows(
        `update companies set name='new owner' where id=1 returning id`,
      )
    ).length,
    1,
  );
  await db.exec(`reset role;
    insert into companies(id,sales_id) values(10,2),(20,2);
    insert into contacts(id,sales_id,company_id) values(10,3,10),(11,2,null);
    insert into tasks(id,sales_id,contact_id,recruitment_id) values(10,3,11,1);
    update companies set sales_id=2 where id=1;
  `);
  await asUser(2);
  check(
    (await rows("delete from companies where id=10 returning id")).length,
    0,
  );
  check(
    (await rows("delete from contacts where id=11 returning id")).length,
    0,
  );
  check(
    (await rows("delete from recruitment where id=1 returning id")).length,
    0,
  );
  check(
    (await rows("delete from companies where id=20 returning id")).length,
    1,
  );
  // Disabling an already logged-in member denies requests using the same identity.
  await db.exec("reset role; update sales set disabled=true where id=2;");
  await asUser(2);
  check((await rows("select id from companies")).length, 0);
  await denied("insert into tasks(id,sales_id) values(999,2)");
  await asUser(4);
  for (const table of [
    "companies",
    "contacts",
    "deals",
    "tasks",
    "recruitment",
    "contact_notes",
    "deal_notes",
  ]) {
    check((await rows(`select id from ${table}`)).length, 0);
    check(
      (await rows(`update ${table} set name='disabled' returning id`)).length,
      0,
    );
  }
  await db.exec("reset role; set role anon;");
  await denied("select * from companies");
  console.warn(
    `${checks} PostgreSQL permission checks passed (isolated local database).`,
  );
} finally {
  await db.close();
}
