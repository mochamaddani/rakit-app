begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures: two users; the trigger must give each one a workspace.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@launchpad.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@launchpad.test');

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has RLS enabled');

select results_eq(
  $$ select count(*)::int from public.workspaces
     where owner_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
  $$ values (2) $$,
  'a workspace is created for each new user');

create temp table ws as select owner_id, id from public.workspaces;
grant select on ws to authenticated;

-- As user A
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
     select id, 'A page', 'a-page', '{"schemaVersion":1}'::jsonb, 1 from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can create a page in their workspace');
select results_eq($$ select count(*)::int from public.pages $$, $$ values (1) $$, 'A sees their page');
select lives_ok(
  $$ insert into public.page_versions (id, page_id, document, html_path, byte_size, html_sha256, kind)
     select v.id, p.id, p.current_draft, p.workspace_id || '/' || p.id || '/' || v.id || '.html', 10,
       repeat('0', 64), 'export'
     from public.pages p, (select gen_random_uuid() as id) v where p.slug = 'a-page' $$,
  'A can record a version of their page');
select lives_ok(
  $$ insert into public.assets (workspace_id, path, mime, size)
     select id, id::text || '/a.webp', 'image/webp', 100 from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can register an asset');
select lives_ok(
  $$ insert into public.templates (workspace_id, name, document)
     select id, 'A template', '{}'::jsonb from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can save a template');
select throws_ok(
  $$ insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
     select id, 'X', 'x', '{}'::jsonb, 1 from ws
     where owner_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'A cannot create a page in B''s workspace');
select throws_ok(
  $$ insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
     select id, 'Bad', 'Bad Slug', '{}'::jsonb, 1 from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'slugs must be lowercase kebab-case');

-- As user B
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is_empty($$ select 1 from public.pages $$, 'B cannot see A''s pages');
select is_empty($$ select 1 from public.page_versions $$, 'B cannot see A''s versions');
select is_empty($$ select 1 from public.assets $$, 'B cannot see A''s assets');
select is_empty($$ select 1 from public.templates where workspace_id is not null $$, 'B cannot see A''s templates');
select is_empty($$ update public.pages set name = 'hacked' returning 1 $$, 'B cannot update A''s pages');
select is_empty($$ delete from public.pages returning 1 $$, 'B cannot delete A''s pages');
select results_eq($$ select count(*)::int from public.workspaces $$, $$ values (1) $$, 'B sees only their own workspace');
select is(
  public.is_workspace_member((select id from ws where owner_id = '11111111-1111-1111-1111-111111111111')),
  false, 'is_workspace_member is false for someone else''s workspace');

-- Back to A
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok($$ update public.page_versions set note = 'changed' $$, '42501', null,
  'versions cannot be updated through the API (no UPDATE privilege)');
select lives_ok($$ update public.pages set name = 'Renamed' where slug = 'a-page' $$, 'A can update their page');
select is((select name from public.pages where slug = 'a-page'), 'Renamed', 'the update is applied');

-- Built-in templates (workspace_id is null) are shared and read-only
reset role;
insert into public.templates (workspace_id, name, document) values (null, 'Built-in', '{}'::jsonb);
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select results_eq($$ select count(*)::int from public.templates where workspace_id is null $$, $$ values (1) $$,
  'built-in templates are visible');
select is_empty($$ update public.templates set name = 'x' where workspace_id is null returning 1 $$,
  'built-in templates are read-only');

-- Anonymous role has no table privileges at all
reset role;
set local role anon;
select throws_ok($$ select 1 from public.pages $$, '42501', null, 'anon cannot read pages');

-- Versions are immutable even for privileged roles
reset role;
select throws_ok($$ update public.page_versions set note = 'x' $$, 'P0001', 'page_versions are immutable',
  'page_versions reject updates even from privileged roles');

select * from finish();
rollback;
