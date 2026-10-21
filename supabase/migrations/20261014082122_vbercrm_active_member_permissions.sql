-- Current membership is checked at the database boundary. CRM data is
-- shared within this single team; account disabling revokes all row access.
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated;
create or replace function crm_private.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.sales where user_id = auth.uid() and disabled is not true
  );
$$;
revoke all on function crm_private.is_active_member() from public, anon;
grant execute on function crm_private.is_active_member() to authenticated;

create policy "Active CRM members only" on public.companies
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.contacts
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.contact_notes
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.sales
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.deals
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.deal_notes
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.tasks
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.tags
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.configuration
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM members only" on public.favicons_excluded_domains
  as restrictive for all to authenticated
  using ((select crm_private.is_active_member()))
  with check ((select crm_private.is_active_member()));

create policy "Active CRM attachment access" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'attachments' or (select crm_private.is_active_member()))
  with check (bucket_id <> 'attachments' or (select crm_private.is_active_member()));
create or replace function public.is_admin() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  return exists (select 1 from public.sales where user_id = auth.uid()
    and administrator = true and disabled is not true);
end;
$$;
