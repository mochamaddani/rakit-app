-- The id of the save that wrote the current draft. A client whose save landed but whose answer
-- was lost finds its own id in the 409 and builds on that revision (docs/DECISIONS.md D-035).
alter table public.pages add column draft_save_id uuid;
