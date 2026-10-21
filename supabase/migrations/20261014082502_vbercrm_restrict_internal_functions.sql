revoke execute on function public.cleanup_note_attachments(), public.handle_contact_note_created_or_updated(), public.handle_new_user(), public.handle_update_user() from public, anon, authenticated;
alter function public.is_admin() security invoker;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
