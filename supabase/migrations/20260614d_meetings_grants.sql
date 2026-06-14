-- meetings / meeting_mail_sends — service_role GRANT 누락 수정 (핫픽스).
-- admin client(service_role)가 PostgREST로 insert/update/delete 하려면 명시적 GRANT 필요.
-- 최초 마이그(20260614b/c)가 authenticated에만 부여 → createMeeting 등 admin 경로가
-- "permission denied for table meetings (42501)"로 실패하던 문제 해결.

begin;

grant select, insert, update, delete on public.meetings to service_role;
grant select, insert, update, delete on public.meeting_mail_sends to service_role;
grant select, insert on public.meeting_mail_sends to authenticated;

notify pgrst, 'reload schema';

commit;
