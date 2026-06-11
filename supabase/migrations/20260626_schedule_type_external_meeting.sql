-- schedule_events.type check constraint 확장 — '외부미팅'(external_meeting) 추가.
-- 기존 6개(shift/event/leave/training/application/pims) 그대로 + 1개 신규.

begin;

alter table public.schedule_events
  drop constraint if exists schedule_events_type_check;

alter table public.schedule_events
  add constraint schedule_events_type_check
  check (type in ('shift', 'event', 'leave', 'training', 'application', 'pims', 'external_meeting'));

commit;

-- PostgREST schema cache reload
notify pgrst, 'reload schema';
