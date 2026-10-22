-- Uploads (docs/DECISIONS.md D-008, D-045). The browser uploads an original to the private
-- `uploads` bucket under its workspace's folder; the processing route, running as the same user,
-- writes WebP variants to the public `assets` bucket and deletes the original.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('assets', 'assets', true, 10485760, array['image/webp']);

-- '<workspace uuid>/…' → that uuid; anything else → null, so is_workspace_member is false, never an error.
create function public.workspace_from_path(name text) returns uuid
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(name, '/', 1)::uuid
  end
$$;
revoke execute on function public.workspace_from_path(text) from public, anon;
grant execute on function public.workspace_from_path(text) to authenticated;

create policy "Members upload originals" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_workspace_member(public.workspace_from_path(name)));
create policy "Members read their originals" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and public.is_workspace_member(public.workspace_from_path(name)));
create policy "Members delete their originals" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and public.is_workspace_member(public.workspace_from_path(name)));

-- Anyone may download variants through the public bucket; these cover the API's own row access.
create policy "Members write asset variants" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and public.is_workspace_member(public.workspace_from_path(name)));
create policy "Members read their asset variants" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and public.is_workspace_member(public.workspace_from_path(name)));
create policy "Members delete their asset variants" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and public.is_workspace_member(public.workspace_from_path(name)));
