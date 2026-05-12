-- Allow authenticated admin users to delete rows from public.contact_messages.
-- Run in Supabase SQL Editor if delete from the admin UI fails with RLS errors.

drop policy if exists "Authenticated users can delete contact messages" on public.contact_messages;

create policy "Authenticated users can delete contact messages"
on public.contact_messages
for delete
to authenticated
using (true);
