begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Uploads (docs/DECISIONS.md D-045): originals in a private bucket, WebP variants in a public one,
-- every object under its workspace's folder.
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'e@launchpad.test'),
  ('66666666-6666-6666-6666-666666666666', 'f@launchpad.test');
create temp table folders as select
  (select id::text from public.workspaces where owner_id = '55555555-5555-5555-5555-555555555555') as e,
  (select id::text from public.workspaces where owner_id = '66666666-6666-6666-6666-666666666666') as f;
grant select on folders to authenticated, anon;

select results_eq(
  $$ select id, public, file_size_limit, allowed_mime_types from storage.buckets
     where id in ('assets', 'uploads') order by id $$,
  $$ values
       ('assets'::text, true, 10485760::bigint, array['image/webp']::text[]),
       ('uploads'::text, false, 10485760::bigint,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']::text[]) $$,
  'assets holds public WebP variants, uploads private originals, both capped at 10 MiB');
select is(public.workspace_from_path('not-a-uuid/x.jpg'), null, 'a folder that is not a uuid maps to null');
select is(
  public.workspace_from_path('55555555-5555-5555-5555-555555555555/x.jpg'),
  '55555555-5555-5555-5555-555555555555'::uuid,
  'the first folder is the workspace');

set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) select 'uploads', e || '/a.jpg' from folders $$,
  'a member uploads an original into their workspace folder');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) select 'assets', e || '/a-1600.webp' from folders $$,
  'and writes processed variants there');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) select 'uploads', f || '/a.jpg' from folders $$,
  '42501', null, 'not into another workspace');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) select 'assets', f || '/a-1600.webp' from folders $$,
  '42501', null, 'nor into its assets');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('uploads', 'loose.jpg') $$,
  '42501', null, 'not outside a workspace folder');
select results_eq(
  $$ select count(*)::int from storage.objects where bucket_id in ('uploads', 'assets') $$,
  $$ values (2) $$, 'a member sees their own objects');

-- The Storage API deletes with this setting; a direct DELETE is otherwise refused.
set local storage.allow_delete_query to 'true';
set local request.jwt.claims to '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select is_empty(
  $$ select 1 from storage.objects where bucket_id in ('uploads', 'assets') $$,
  'other members cannot see them');
select is_empty(
  $$ delete from storage.objects where bucket_id in ('uploads', 'assets') returning 1 $$,
  'nor delete them');

set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select results_eq(
  $$ with gone as (delete from storage.objects where bucket_id = 'uploads' returning 1)
     select count(*)::int from gone $$,
  $$ values (1) $$, 'the owner deletes an original once it is processed');

reset role;
set local role anon;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('uploads', '55555555-5555-5555-5555-555555555555/b.jpg') $$,
  '42501', null, 'anon cannot upload');
select throws_ok(
  $$ select public.workspace_from_path('x/y') $$,
  '42501', null, 'anon cannot call the path helper');

reset role;
select * from finish();
rollback;
