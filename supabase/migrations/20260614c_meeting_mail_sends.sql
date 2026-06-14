-- meeting_mail_sends — 회의록 발송 이력. insert는 service_role(server only), read 전원.

begin;

create table if not exists public.meeting_mail_sends (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid references public.meetings(id) on delete cascade,
  sent_by_email text not null,
  recipients    jsonb not null default '[]',
  subject       text not null,
  status        text not null default 'sent'
                check (status in ('sent','dry_run','failed')),
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists meeting_mail_sends_meeting_idx on public.meeting_mail_sends (meeting_id);

alter table public.meeting_mail_sends enable row level security;

drop policy if exists meeting_mail_sends_read on public.meeting_mail_sends;
create policy meeting_mail_sends_read on public.meeting_mail_sends
  for select to authenticated using (true);

grant select on public.meeting_mail_sends to authenticated;

notify pgrst, 'reload schema';

commit;
