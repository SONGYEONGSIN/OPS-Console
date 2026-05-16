-- incidents.assignee_email / assignee_name NULL 허용 (PR-7)
-- 시트 import 시 운영자 매칭 실패한 row (e.g. 퇴사자) 보존 위해 NULL 허용.
-- 신규 등록은 actions.ts가 현 operator로 자동 채우므로 NOT NULL 충족.

begin;

alter table public.incidents
  alter column assignee_email drop not null,
  alter column assignee_name  drop not null;

notify pgrst, 'reload schema';

commit;

-- 검증:
-- select column_name, is_nullable from information_schema.columns
--  where table_schema='public' and table_name='incidents'
--    and column_name in ('assignee_email','assignee_name');
-- → 2 row, is_nullable='YES'
