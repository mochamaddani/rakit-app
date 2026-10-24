-- Exports (docs/DECISIONS.md D-049). The browser uploads the exported HTML to the private
-- `page-versions` bucket at '<workspace>/<page>/<version>.html', then calls record_page_version,
-- which inserts the immutable version row and points the page at it.

-- The draft revision the export was built from, so the editor can tell whether the draft changed.
alter table public.page_versions
  add column draft_revision int check (draft_revision >= 0);

-- A page points only at its own versions (M0/M1 review m-6): the old key accepted any version.
alter table public.page_versions
  add constraint page_versions_id_page_id_key unique (id, page_id);
alter table public.pages drop constraint pages_latest_version_id_fkey;
alter table public.pages
  add constraint pages_latest_version_fkey
  foreign key (latest_version_id, id) references public.page_versions (id, page_id)
  on delete set null (latest_version_id);

-- The stored file's path is derived from the row, so a version can never name another
-- workspace's or another page's file. A page the caller can't see has no workspace here.
create function public.check_page_version_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ws uuid;
begin
  select p.workspace_id into ws from public.pages p where p.id = new.page_id;
  if ws is null
    or new.html_path is distinct from ws::text || '/' || new.page_id::text || '/' || new.id::text || '.html'
  then
    raise exception 'html_path must be <workspace>/<page>/<version>.html';
  end if;
  return new;
end;
$$;

create trigger page_versions_check_path
  before insert on public.page_versions
  for each row execute function public.check_page_version_path();

-- Runs as the caller, so RLS decides which pages it may record exports for.
create function public.record_page_version(
  p_id uuid,
  p_page_id uuid,
  p_document jsonb,
  p_html_path text,
  p_export_settings jsonb,
  p_byte_size int,
  p_html_sha256 text,
  p_draft_revision int
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created timestamptz;
begin
  insert into public.page_versions
    (id, page_id, document, html_path, export_settings, byte_size, html_sha256, kind, draft_revision)
  values
    (p_id, p_page_id, p_document, p_html_path, coalesce(p_export_settings, '{}'), p_byte_size,
     p_html_sha256, 'export', p_draft_revision)
  returning created_at into created;

  -- A draft becomes exported; live and archived pages keep their status.
  update public.pages
    set latest_version_id = p_id,
        status = case when status = 'draft' then 'exported' else status end
    where id = p_page_id;
  if not found then
    raise exception 'page % not found', p_page_id;
  end if;
  return created;
end;
$$;
revoke execute on function public.record_page_version(uuid, uuid, jsonb, text, jsonb, int, text, int)
  from public, anon;
grant execute on function public.record_page_version(uuid, uuid, jsonb, text, jsonb, int, text, int)
  to authenticated;

-- Stored exports: private, HTML only, never updated (there is no update policy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('page-versions', 'page-versions', false, 20971520, array['text/html']);

create policy "Members store their exports" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'page-versions' and public.is_workspace_member(public.workspace_from_path(name)));
create policy "Members read their exports" on storage.objects
  for select to authenticated
  using (bucket_id = 'page-versions' and public.is_workspace_member(public.workspace_from_path(name)));
create policy "Members delete their exports" on storage.objects
  for delete to authenticated
  using (bucket_id = 'page-versions' and public.is_workspace_member(public.workspace_from_path(name)));
