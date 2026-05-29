-- backup_requests.leave_type — 휴가/외근 유형 (경조휴가/반차/연차/출장/외근/기타 등).
-- EditForm 셀렉트에서 선택, 인스펙터 읽기뷰에 표시. NULL 허용 (기존 row + 미선택).
-- 값 검증은 애플리케이션(zod leaveTypeSchema)에서 수행 — DB는 plain text로 유연성 유지
-- (requester_team과 동일 정책).

begin;

alter table public.backup_requests
  add column if not exists leave_type text;

notify pgrst, 'reload schema';

commit;

-- 검증:
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='backup_requests' and column_name='leave_type';
-- → 1 row: leave_type | text
