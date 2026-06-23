-- mailbox_delegations RLS + GRANT
-- 정책: SELECT 전원 read / I·U·D 정책 없음 → service_role(서버 액션)만 쓰기
begin;

alter table public.mailbox_delegations enable row level security;

drop policy if exists "mailbox_delegations_select_all" on public.mailbox_delegations;
create policy "mailbox_delegations_select_all"
  on public.mailbox_delegations for select
  to authenticated
  using (true);

grant select on public.mailbox_delegations to authenticated;
grant all on public.mailbox_delegations to service_role;

commit;

notify pgrst, 'reload schema';
