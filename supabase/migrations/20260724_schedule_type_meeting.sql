-- schedule_events.type check constraint 확장 — '회의'(meeting) 추가.
-- 기존 7개(shift/event/leave/training/application/pims/external_meeting) + meeting(내부 회의, 외부미팅과 구분).

begin;

alter table public.schedule_events
  drop constraint if exists schedule_events_type_check;

alter table public.schedule_events
  add constraint schedule_events_type_check
  check (type in ('shift', 'event', 'leave', 'training', 'application', 'pims', 'external_meeting', 'meeting'));

commit;

-- PostgREST schema cache reload
notify pgrst, 'reload schema';
