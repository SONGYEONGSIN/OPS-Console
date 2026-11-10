-- 경쟁률 점검 실행 조건 — [지금 실행] 조건 창이 고른 대학구분·모집구분을 요청 행에 싣는다.
-- 폴러는 요청 id 만 넘기고, 대상 API(/api/ratio-audit/targets?requestId=)가 이 칸을 읽어 대상을 고른다.
-- 값 예: {"univ": ["2년제"], "recruit": ["수시"]} — 검증은 서버 zod(run-filters.ts)가 쓸 때·읽을 때 한다.
-- nullable 이고 제약이 없다: 옛 요청 이력은 조건이 없고, 적용~배포 사이 옛 화면의 적재를 막지 않기 위해서다
-- (그 사이 생긴 조건 없는 요청은 새 대상 API 가 409 로 거절해 Moa 로그인 전에 멈춘다).

begin;

alter table public.ratio_audit_requests
  add column if not exists filters jsonb;

-- 조건 없이 대기 중인 요청은 새 흐름에서 돌 수 없다 — 지금 마감해 두고 다시 누르게 한다.
update public.ratio_audit_requests
   set status = 'failed',
       finished_at = now(),
       message = '실행 조건 도입 전 요청 — 자동화 페이지에서 조건을 골라 다시 실행하세요'
 where status = 'pending'
   and filters is null;

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select data_type, is_nullable from information_schema.columns
--  where table_name = 'ratio_audit_requests' and column_name = 'filters';            → jsonb, YES
-- select status, count(*) from public.ratio_audit_requests where filters is null group by status; → pending 없음
