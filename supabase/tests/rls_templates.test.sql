begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Saved templates carry a category and a description (docs/DECISIONS.md D-055). The category list
-- lives in code; the database only checks its shape.
insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999991', 't1@launchpad.test'),
  ('99999999-9999-9999-9999-999999999992', 't2@launchpad.test');
create temp table t as select
  (select id from public.workspaces where owner_id = '99999999-9999-9999-9999-999999999991') as wa;
grant select on t to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub":"99999999-9999-9999-9999-999999999991","role":"authenticated"}';

select lives_ok(
  $$ insert into public.templates (workspace_id, name, document, category, description)
     select wa, 'Herbal', '{}'::jsonb, 'herbal', 'Teh dan jamu' from t $$,
  'A can save a template with a category and a description');
select lives_ok(
  $$ insert into public.templates (workspace_id, name, document) select wa, 'Plain', '{}'::jsonb from t $$,
  'category and description are optional');
select results_eq(
  $$ select category, description from public.templates where name = 'Plain' $$,
  $$ values ('other'::text, ''::text) $$,
  'the category defaults to other and the description to empty');
select throws_ok(
  $$ insert into public.templates (workspace_id, name, document, category) select wa, 'x', '{}'::jsonb, 'Herbal' from t $$,
  '23514', null, 'categories are lowercase');
select throws_ok(
  $$ insert into public.templates (workspace_id, name, document, category) select wa, 'x', '{}'::jsonb, '<b>' from t $$,
  '23514', null, 'categories are slugs');
select throws_ok(
  $$ insert into public.templates (workspace_id, name, document, category) select wa, 'x', '{}'::jsonb, repeat('a', 32) from t $$,
  '23514', null, 'categories are at most 31 characters');
select throws_ok(
  $$ insert into public.templates (workspace_id, name, document, description) select wa, 'x', '{}'::jsonb, repeat('a', 301) from t $$,
  '23514', null, 'descriptions are at most 300 characters');
select lives_ok(
  $$ update public.templates set category = 'fashion' where name = 'Herbal' $$,
  'A can change a template''s category');
select is((select category from public.templates where name = 'Herbal'), 'fashion', 'the change is applied');

set local request.jwt.claims to '{"sub":"99999999-9999-9999-9999-999999999992","role":"authenticated"}';
select is_empty($$ select 1 from public.templates where workspace_id is not null $$, 'B cannot see A''s templates');
select is_empty($$ update public.templates set category = 'herbal' returning 1 $$, 'B cannot recategorize A''s templates');

reset role;
insert into public.templates (workspace_id, name, document) values (null, 'Built-in', '{}'::jsonb);
set local role authenticated;
select is_empty($$ update public.templates set category = 'herbal' where workspace_id is null returning 1 $$,
  'nobody can recategorize a null-workspace row');

select * from finish();
rollback;
