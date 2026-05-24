-- schedule_events.type check constraint 확장
-- 진학사 운영 컨텍스트 — '원서접수'(application) / 'PIMS'(pims) 분류 추가.
-- 기존 4개(shift/event/leave/training) 그대로 + 2개 신규.

begin;

alter table public.schedule_events
  drop constraint if exists schedule_events_type_check;

alter table public.schedule_events
  add constraint schedule_events_type_check
  check (type in ('shift', 'event', 'leave', 'training', 'application', 'pims'));

commit;

-- PostgREST schema cache reload
notify pgrst, 'reload schema';
