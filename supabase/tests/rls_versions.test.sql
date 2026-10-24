begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Exports (docs/DECISIONS.md D-049): recorded through record_page_version, stored under
-- '<workspace>/<page>/<version>.html' in the private page-versions bucket; a page points only at
-- its own versions (M0/M1 review m-6).
insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'g@launchpad.test'),
  ('88888888-8888-8888-8888-888888888888', 'h@launchpad.test');
create temp table t as select
  (select id from public.workspaces where owner_id = '77777777-7777-7777-7777-777777777777') as wa,
  (select id from public.workspaces where owner_id = '88888888-8888-8888-8888-888888888888') as wb,
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid as a1,
  'aaaaaaaa-0000-4000-8000-000000000002'::uuid as a2,
  'bbbbbbbb-0000-4000-8000-000000000001'::uuid as b1,
  'cccccccc-0000-4000-8000-000000000001'::uuid as v1,
  'cccccccc-0000-4000-8000-000000000002'::uuid as v2,
  'cccccccc-0000-4000-8000-000000000003'::uuid as v3,
  'cccccccc-0000-4000-8000-000000000004'::uuid as v4,
  repeat('a', 64) as sha;
grant select on t to authenticated, anon;

insert into public.pages (id, workspace_id, name, slug, current_draft, schema_version, status)
  select a1, wa, 'A one', 'a-one', '{}'::jsonb, 1, 'draft' from t
  union all select a2, wa, 'A two', 'a-two', '{}', 1, 'archived' from t
  union all select b1, wb, 'B one', 'b-one', '{}', 1, 'draft' from t;
insert into public.templates (workspace_id, name, document)
  select wa, 'A template', '{}'::jsonb from t
  union all select null, 'Built-in', '{}'::jsonb;
insert into public.assets (workspace_id, path, mime, size)
  select wa, wa || '/x', 'image/webp', 1 from t;

create function pg_temp.record(v uuid, page uuid, path text) returns timestamptz language sql as $$
  select public.record_page_version(v, page, '{"schemaVersion":1}', path, '{"images":"portable"}', 100,
    repeat('a', 64), 3)
$$;
create function pg_temp.path(ws uuid, page uuid, v uuid) returns text language sql as $$
  select ws::text || '/' || page::text || '/' || v::text || '.html'
$$;
grant execute on function pg_temp.record(uuid, uuid, text), pg_temp.path(uuid, uuid, uuid)
  to authenticated, anon;

select has_function('public', 'record_page_version', 'exports are recorded by one function');
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'page-versions' $$,
  $$ values (false, 20971520::bigint, array['text/html']::text[]) $$,
  'page-versions is a private bucket of HTML files up to 20 MiB');

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';
select lives_ok($$ select pg_temp.record(v1, a1, pg_temp.path(wa, a1, v1)) from t $$,
  'a member records an export of their page');
select results_eq($$ select latest_version_id, status from public.pages where slug = 'a-one' $$,
  $$ select v1, 'exported'::text from t $$, 'the page points at it and is exported');
select results_eq(
  $$ select html_sha256, draft_revision, kind, export_settings from public.page_versions where id = (select v1 from t) $$,
  $$ select sha, 3, 'export'::text, '{"images":"portable"}'::jsonb from t $$,
  'the version keeps its hash, draft revision and settings');
select lives_ok($$ select pg_temp.record(v2, a1, pg_temp.path(wa, a1, v2)) from t $$,
  'a second export');
select results_eq($$ select latest_version_id, status from public.pages where slug = 'a-one' $$,
  $$ select v2, 'exported'::text from t $$, 'moves the page to the newest version');
select lives_ok($$ select pg_temp.record(v3, a2, pg_temp.path(wa, a2, v3)) from t $$,
  'an archived page can be exported');
select results_eq($$ select status from public.pages where slug = 'a-two' $$,
  $$ values ('archived'::text) $$, 'and stays archived');
select throws_ok($$ select pg_temp.record(v4, a1, pg_temp.path(wb, a1, v4)) from t $$,
  null, null, 'a path in another workspace is refused');
select throws_ok($$ select pg_temp.record(v4, a1, pg_temp.path(wa, a2, v4)) from t $$,
  null, null, 'a path naming another page is refused');
select throws_ok($$ select pg_temp.record(v4, a1, pg_temp.path(wa, a1, v1)) from t $$,
  null, null, 'a path naming another version is refused');
select throws_ok($$ update public.pages set latest_version_id = (select v3 from t) where slug = 'a-one' $$,
  '23503', null, 'a page cannot point at another page''s version (m-6)');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) select 'page-versions', pg_temp.path(wa, a1, v1) from t $$,
  'a member stores the export file in their folder');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'page-versions' $$,
  $$ values (1) $$, 'and reads it back');
select is_empty(
  $$ update storage.objects set name = name || '.x' where bucket_id = 'page-versions' returning 1 $$,
  'stored exports are immutable');
select results_eq($$ select count(*)::int from public.templates $$, $$ values (2) $$,
  'a member reads their own and built-in templates');

set local request.jwt.claims to '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';
select throws_ok($$ select pg_temp.record(v4, a1, pg_temp.path(wa, a1, v4)) from t $$,
  null, null, 'another user cannot record an export of the page');
select throws_ok(
  $$ insert into public.page_versions (id, page_id, document, html_path, byte_size, html_sha256, kind)
     select v4, a1, '{}', pg_temp.path(wa, a1, v4), 1, sha, 'export' from t $$,
  null, null, 'nor insert a version directly');
select is_empty($$ select 1 from public.page_versions $$, 'nor see its versions');
select is_empty($$ select 1 from storage.objects where bucket_id = 'page-versions' $$,
  'nor its stored files');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) select 'page-versions', pg_temp.path(wa, a1, v4) from t $$,
  '42501', null, 'nor store files in its folder');
select is_empty($$ select 1 from public.assets $$, 'another user cannot read the workspace''s assets');
select throws_ok(
  $$ insert into public.assets (workspace_id, path, mime, size) select wa, wa || '/y', 'image/webp', 1 from t $$,
  '42501', null, 'nor add assets to it');
select is_empty($$ select 1 from public.templates where workspace_id is not null $$,
  'nor read its templates');
select is_empty($$ update public.templates set name = 'x' where workspace_id is not null returning 1 $$,
  'nor rename them');
select is_empty($$ delete from public.templates where workspace_id is not null returning 1 $$,
  'nor delete them');
select results_eq($$ select name from public.templates $$, $$ values ('Built-in'::text) $$,
  'but reads built-in templates');

reset role;
set local role anon;
select throws_ok($$ select pg_temp.record(v4, a1, pg_temp.path(wa, a1, v4)) from t $$,
  '42501', null, 'anon cannot record exports');

reset role;
select * from finish();
rollback;
