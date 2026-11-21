-- 주간업무보고 A2 — 알림 발송 이력.
-- 같은 주·같은 슬롯·같은 받는 사람에게는 한 번만(cron 이 두 번 불려도). failed 는 다음 호출이 다시 보낸다.
-- slot 예: request · remind:2026-11-19:noon · manual:2026-11-20T09:12:00Z · all-submitted · returned:<report>:<시각> · reported
-- recipient 는 메일 주소 또는 teams:<chat id>.

create table if not exists public.ops_weekly_notices (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.ops_weekly_weeks (id) on delete cascade,
  kind text not null check (kind in ('request', 'remind', 'all-submitted', 'returned', 'reported')),
  slot text not null,
  recipient text not null,
  status text not null check (status in ('sent', 'dry_run', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, slot, recipient)
);

create index if not exists ops_weekly_notices_week_idx on public.ops_weekly_notices (week_id);

alter table public.ops_weekly_notices enable row level security;
revoke all on public.ops_weekly_notices from public, anon, authenticated;
grant select on public.ops_weekly_notices to authenticated;
grant all on public.ops_weekly_notices to service_role;
drop policy if exists "ops_weekly_notices_select" on public.ops_weekly_notices;
create policy "ops_weekly_notices_select" on public.ops_weekly_notices for select to authenticated using ((select public.is_admin()));
