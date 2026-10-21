-- Keep historical tasks when a recruitment record is removed.
alter table public.tasks add column recruitment_id bigint references public.recruitment(id) on delete set null;
create index tasks_recruitment_id_idx on public.tasks(recruitment_id);
-- A next follow-up is created only after the current one is completed.
create unique index tasks_one_open_recruitment on public.tasks(recruitment_id)
where recruitment_id is not null and done_date is null;
