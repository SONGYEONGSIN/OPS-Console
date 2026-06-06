-- smileedi_mail_sends RLS — select admin/member, write service_role only.
-- (service_notice_mail_sends / receivables_mail_sends 정책과 동일 패턴)

begin;

alter table public.smileedi_mail_sends enable row level security;

drop policy if exists "smileedi_mail_sends_select" on public.smileedi_mail_sends;
create policy "smileedi_mail_sends_select"
  on public.smileedi_mail_sends for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated 차단, service_role(RLS bypass)만 쓰기.

grant select on public.smileedi_mail_sends to authenticated;
grant all on public.smileedi_mail_sends to service_role;

commit;

notify pgrst, 'reload schema';
