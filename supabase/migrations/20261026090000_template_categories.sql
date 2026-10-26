-- Saved templates get a category and a description (docs/DECISIONS.md D-055). Built-in templates
-- live in code (lib/templates/builtin), so rows with a null workspace_id stay possible but unused.
-- The category list is code too; the database only checks the slug shape, so a new category needs
-- no migration and an unknown one shows as "Other".

alter table public.templates
  add column category text not null default 'other'
    check (category ~ '^[a-z][a-z0-9-]{0,30}$'),
  add column description text not null default ''
    check (char_length(description) <= 300);

create index templates_workspace_category_idx on public.templates (workspace_id, category);
