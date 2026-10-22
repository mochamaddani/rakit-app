-- Draft saves use optimistic concurrency on a counter (docs/DECISIONS.md D-035).
alter table public.pages
  add column draft_revision int not null default 0 check (draft_revision >= 0);

-- RLS policies evaluate the helper as `authenticated`; anon must not reach it through /rpc (M0/M1 review m-7).
revoke execute on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
