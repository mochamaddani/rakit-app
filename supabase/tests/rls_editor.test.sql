begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'c@launchpad.test'),
  ('44444444-4444-4444-4444-444444444444', 'd@launchpad.test');
create temp table ws as select owner_id, id from public.workspaces;
grant select on ws to authenticated;

select has_column('public', 'pages', 'draft_revision', 'pages has a draft revision counter');
select col_default_is('public', 'pages', 'draft_revision', '0', 'new pages start at revision 0');

set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
  select id, 'C page', 'c-page', '{"schemaVersion":1}'::jsonb, 1 from ws
  where owner_id = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$ update public.pages set current_draft = '{"schemaVersion":1,"sections":[]}', draft_revision = 1
     where slug = 'c-page' and draft_revision = 0 returning draft_revision $$,
  $$ values (1) $$, 'a save with the current revision bumps it');
select is_empty(
  $$ update public.pages set draft_revision = 1 where slug = 'c-page' and draft_revision = 0 returning 1 $$,
  'a save with a stale revision matches no row');
select throws_ok($$ update public.pages set draft_revision = -1 where slug = 'c-page' $$, '23514', null,
  'revisions cannot go negative');

set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select is_empty($$ update public.pages set draft_revision = 2 where slug = 'c-page' returning 1 $$,
  'another user cannot bump the revision');
select lives_ok($$ select public.is_workspace_member(gen_random_uuid()) $$,
  'signed-in users can still evaluate the membership helper');

reset role;
set local role anon;
select throws_ok($$ select public.is_workspace_member(gen_random_uuid()) $$, '42501', null,
  'anon cannot call is_workspace_member through /rpc');

reset role;
select * from finish();
rollback;
