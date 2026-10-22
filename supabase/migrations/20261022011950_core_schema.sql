-- Core schema: workspaces, pages, page_versions, templates, assets.
-- Every table is scoped by workspace through public.is_workspace_member() (docs/DECISIONS.md D-005);
-- multi-user later only changes that function.

-- Tables -------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index workspaces_owner_id_idx on public.workspaces (owner_id);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  status text not null default 'draft' check (status in ('draft', 'exported', 'live', 'archived')),
  tags text[] not null default '{}',
  current_draft jsonb not null,
  schema_version int not null check (schema_version >= 1),
  latest_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index pages_workspace_updated_idx on public.pages (workspace_id, updated_at desc);
create index pages_tags_idx on public.pages using gin (tags);

-- Exported HTML lives in Storage (docs/DECISIONS.md D-006); the row keeps its path, size and hash.
create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  document jsonb not null,
  html_path text not null,
  export_settings jsonb not null default '{}',
  byte_size int not null check (byte_size >= 0),
  html_sha256 text not null check (html_sha256 ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('export', 'publish')),
  note text,
  created_at timestamptz not null default now()
);
create index page_versions_page_created_idx on public.page_versions (page_id, created_at desc);

alter table public.pages
  add constraint pages_latest_version_id_fkey
  foreign key (latest_version_id) references public.page_versions (id) on delete set null;

-- workspace_id is null for built-in templates shared with every workspace.
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  document jsonb not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_workspace_id_idx on public.templates (workspace_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  path text not null unique,
  mime text not null check (mime ~ '^image/'),
  width int,
  height int,
  size int not null check (size >= 0),
  created_at timestamptz not null default now()
);
create index assets_workspace_id_idx on public.assets (workspace_id);

-- Functions and triggers ---------------------------------------------------

create function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = (select auth.uid())
  );
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

create function public.reject_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% are immutable', tg_table_name;
end;
$$;

create trigger page_versions_immutable
  before update on public.page_versions
  for each row execute function public.reject_update();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspaces (name, owner_id) values ('My workspace', new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileges ---------------------------------------------------------------
-- Supabase's default privileges grant everything to anon and authenticated; start from nothing.

revoke all on public.workspaces, public.pages, public.page_versions, public.templates, public.assets
  from anon, authenticated;

grant select on public.workspaces to authenticated;
grant select, insert, update, delete on public.pages, public.templates, public.assets to authenticated;
grant select, insert on public.page_versions to authenticated;

-- Row level security -------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.pages enable row level security;
alter table public.page_versions enable row level security;
alter table public.templates enable row level security;
alter table public.assets enable row level security;

create policy "Owners read their workspaces" on public.workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Members manage their pages" on public.pages
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Members read versions of their pages" on public.page_versions
  for select to authenticated
  using (exists (
    select 1 from public.pages p
    where p.id = page_id and public.is_workspace_member(p.workspace_id)
  ));

create policy "Members add versions to their pages" on public.page_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.pages p
    where p.id = page_id and public.is_workspace_member(p.workspace_id)
  ));

create policy "Members read built-in and own templates" on public.templates
  for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "Members create own templates" on public.templates
  for insert to authenticated
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "Members update own templates" on public.templates
  for update to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "Members delete own templates" on public.templates
  for delete to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "Members manage their assets" on public.assets
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
