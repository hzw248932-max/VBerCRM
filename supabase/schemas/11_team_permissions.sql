-- Shared reads; writes restricted to the record owner or an active administrator.
-- Existing restrictive active-member policies remain in effect.
create or replace function crm_private.can_manage(owner_id bigint) returns boolean
language sql stable security invoker set search_path = '' as $$
  select (select public.is_admin()) or exists (
    select 1 from public.sales s where s.id = owner_id
      and s.user_id = (select auth.uid()) and s.disabled is not true
  );
$$;
revoke all on function crm_private.can_manage(bigint) from public, anon;
grant execute on function crm_private.can_manage(bigint) to authenticated;

-- Apply ownership checks to both the old and new row, blocking reassignment
-- by members even when they bypass the UI and call the API directly.
create policy owner_insert on public.companies as restrictive for insert to authenticated with check (crm_private.can_manage(sales_id));
create policy owner_update on public.companies as restrictive for update to authenticated using (crm_private.can_manage(sales_id)) with check (crm_private.can_manage(sales_id));
create policy owner_delete on public.companies as restrictive for delete to authenticated using (crm_private.can_manage(sales_id));
create policy owner_insert on public.contacts as restrictive for insert to authenticated with check (crm_private.can_manage(sales_id));
create policy owner_update on public.contacts as restrictive for update to authenticated using (crm_private.can_manage(sales_id)) with check (crm_private.can_manage(sales_id));
create policy owner_delete on public.contacts as restrictive for delete to authenticated using (crm_private.can_manage(sales_id));
create policy owner_insert on public.deals as restrictive for insert to authenticated with check (crm_private.can_manage(sales_id));
create policy owner_update on public.deals as restrictive for update to authenticated using (crm_private.can_manage(sales_id)) with check (crm_private.can_manage(sales_id));
create policy owner_delete on public.deals as restrictive for delete to authenticated using (crm_private.can_manage(sales_id));
create policy owner_insert on public.tasks as restrictive for insert to authenticated with check (crm_private.can_manage(sales_id));
create policy owner_update on public.tasks as restrictive for update to authenticated using (crm_private.can_manage(sales_id)) with check (crm_private.can_manage(sales_id));
create policy owner_delete on public.tasks as restrictive for delete to authenticated using (crm_private.can_manage(sales_id));
create policy owner_insert on public.recruitment as restrictive for insert to authenticated with check (exists (select 1 from public.companies p where p.id = recruitment.company_id and crm_private.can_manage(p.sales_id)));
create policy owner_update on public.recruitment as restrictive for update to authenticated using (exists (select 1 from public.companies p where p.id = recruitment.company_id and crm_private.can_manage(p.sales_id))) with check (exists (select 1 from public.companies p where p.id = recruitment.company_id and crm_private.can_manage(p.sales_id)));
create policy owner_delete on public.recruitment as restrictive for delete to authenticated using (exists (select 1 from public.companies p where p.id = recruitment.company_id and crm_private.can_manage(p.sales_id)));
create policy owner_insert on public.contact_notes as restrictive for insert to authenticated with check (exists (select 1 from public.contacts p where p.id = contact_notes.contact_id and crm_private.can_manage(p.sales_id)));
create policy owner_update on public.contact_notes as restrictive for update to authenticated using (exists (select 1 from public.contacts p where p.id = contact_notes.contact_id and crm_private.can_manage(p.sales_id))) with check (exists (select 1 from public.contacts p where p.id = contact_notes.contact_id and crm_private.can_manage(p.sales_id)));
create policy owner_delete on public.contact_notes as restrictive for delete to authenticated using (exists (select 1 from public.contacts p where p.id = contact_notes.contact_id and crm_private.can_manage(p.sales_id)));
create policy owner_insert on public.deal_notes as restrictive for insert to authenticated with check (exists (select 1 from public.deals p where p.id = deal_notes.deal_id and crm_private.can_manage(p.sales_id)));
create policy owner_update on public.deal_notes as restrictive for update to authenticated using (exists (select 1 from public.deals p where p.id = deal_notes.deal_id and crm_private.can_manage(p.sales_id))) with check (exists (select 1 from public.deals p where p.id = deal_notes.deal_id and crm_private.can_manage(p.sales_id)));
create policy owner_delete on public.deal_notes as restrictive for delete to authenticated using (exists (select 1 from public.deals p where p.id = deal_notes.deal_id and crm_private.can_manage(p.sales_id)));

-- Only active members can receive new assignments. Existing disabled owners
-- remain attached to their history until an administrator explicitly transfers it.
create or replace function crm_private.validate_assignment() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' or new.sales_id is distinct from old.sales_id then
    if new.sales_id is not null and not exists (
      select 1 from public.sales where id = new.sales_id and disabled is not true
    ) then
      raise exception 'The assignee must be an active CRM member' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.validate_assignment() from public, anon, authenticated;
create trigger validate_assignment before insert or update on public.companies for each row execute function crm_private.validate_assignment();
create trigger validate_assignment before insert or update on public.contacts for each row execute function crm_private.validate_assignment();
create trigger validate_assignment before insert or update on public.deals for each row execute function crm_private.validate_assignment();
create trigger validate_assignment before insert or update on public.tasks for each row execute function crm_private.validate_assignment();

-- Foreign-key cascades bypass child RLS. Do not let an owner delete another
-- member's contacts, deals or tasks indirectly by deleting their parent.
create policy protect_company_children on public.companies as restrictive for delete to authenticated using (
  public.is_admin() or (
    not exists (select 1 from public.contacts c where c.company_id = companies.id and not crm_private.can_manage(c.sales_id))
    and not exists (select 1 from public.deals d where d.company_id = companies.id and not crm_private.can_manage(d.sales_id))
    and not exists (select 1 from public.tasks t join public.contacts c on c.id = t.contact_id where c.company_id = companies.id and not crm_private.can_manage(t.sales_id))
    and not exists (select 1 from public.tasks t join public.recruitment r on r.id = t.recruitment_id where r.company_id = companies.id and not crm_private.can_manage(t.sales_id))
  )
);
create policy protect_contact_tasks on public.contacts as restrictive for delete to authenticated using (
  public.is_admin() or not exists (select 1 from public.tasks t where t.contact_id = contacts.id and not crm_private.can_manage(t.sales_id))
);
create policy protect_recruitment_tasks on public.recruitment as restrictive for delete to authenticated using (
  public.is_admin() or not exists (select 1 from public.tasks t where t.recruitment_id = recruitment.id and not crm_private.can_manage(t.sales_id))
);
