-- 운영자 일정 (schedule_events) — 단일 테이블 + type enum
-- 시프트 / 이벤트 / 휴가 / 교육 4종을 한 모델로. ListPattern schedule variant와 1:1 대칭.
-- RLS는 별도 마이그레이션(20260513b).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.schedule_events (
  id                uuid primary key default uuid_generate_v4(),
  type              text not null
                    check (type in ('shift', 'event', 'leave', 'training')),
  title             text not null,
  description       text,
  start_at          timestamptz not null,
  end_at            timestamptz,                                  -- nullable: open-ended
  all_day           boolean not null default false,
  assignee_email    text,                                         -- nullable: 팀 공통 일정
  created_by_email  text not null,                                -- 등록자 (operators.email 일관)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint schedule_events_end_after_start
    check (end_at is null or end_at >= start_at)
);

-- updated_at 자동 (operators 마이그레이션의 set_updated_at 함수 재사용)
drop trigger if exists schedule_events_set_updated_at on public.schedule_events;
create trigger schedule_events_set_updated_at
before update on public.schedule_events
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists schedule_events_start_at_idx
  on public.schedule_events (start_at desc);

create index if not exists schedule_events_assignee_email_idx
  on public.schedule_events (assignee_email);

create index if not exists schedule_events_type_idx
  on public.schedule_events (type);

------------------------------------------------------------
-- 3) 시드 — 3건 (shift / event / leave)
------------------------------------------------------------

insert into public.schedule_events
  (type, title, description, start_at, end_at, all_day,
   assignee_email, created_by_email, created_at)
values
  ('shift',  '운영2팀 주간 시프트',
             '14:00~22:00 KST 정규 시프트. 1차 온콜은 자동 배정.',
             '2026-05-13T05:00:00Z', '2026-05-13T13:00:00Z', false,
             null, 'ys1114@jinhakapply.com',
             '2026-05-10T00:00:00+09:00'),
  ('event',  '주간 운영 회의',
             '시프트 인수인계 + 주간 이슈 공유. 회의실 B.',
             '2026-05-15T01:00:00Z', '2026-05-15T02:00:00Z', false,
             null, 'alcure23@jinhakapply.com',
             '2026-05-09T00:00:00+09:00'),
  ('leave',  '김지나 사원 휴가',
             '연차 사용. 시프트는 임종우 매니저가 대리.',
             '2026-05-20T00:00:00Z', '2026-05-20T23:59:59Z', true,
             'kjn@jinhakapply.com', 'ys1114@jinhakapply.com',
             '2026-05-08T00:00:00+09:00');

commit;

------------------------------------------------------------
-- 4) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select count(*), type from public.schedule_events group by type order by 1 desc;
-- 기대: shift 1, event 1, leave 1 (총 3)
