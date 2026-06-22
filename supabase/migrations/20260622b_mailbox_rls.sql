-- mailbox RLS — read: authenticated 전원 / write: service_role only (ingest 잡 + server action)
-- worklog(20260604b) service_role-write 패턴 차용. owner 게이트는 페이지 owner_email=me 필터.

begin;

alter table public.mailbox_messages enable row level security;
alter table public.mailbox_drafts   enable row level security;
alter table public.mailbox_settings enable row level security;

-- read: authenticated 전원 (운영부 공개 조회)
drop policy if exists mailbox_messages_read on public.mailbox_messages;
create policy mailbox_messages_read on public.mailbox_messages
  for select to authenticated using (true);

drop policy if exists mailbox_drafts_read on public.mailbox_drafts;
create policy mailbox_drafts_read on public.mailbox_drafts
  for select to authenticated using (true);

drop policy if exists mailbox_settings_read on public.mailbox_settings;
create policy mailbox_settings_read on public.mailbox_settings
  for select to authenticated using (true);

-- insert/update/delete 정책 없음 → authenticated 차단. service_role만 쓰기.
grant select on public.mailbox_messages to authenticated;
grant select on public.mailbox_drafts   to authenticated;
grant select on public.mailbox_settings to authenticated;
grant all on public.mailbox_messages to service_role;
grant all on public.mailbox_drafts   to service_role;
grant all on public.mailbox_settings to service_role;

-- 준실시간 표시 — realtime publication 등록 (이미 멤버면 무시)
do $$
begin
  alter publication supabase_realtime add table public.mailbox_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.mailbox_drafts;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

commit;
