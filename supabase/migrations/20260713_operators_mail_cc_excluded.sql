-- 운영자별 자동 CC 제외 플래그 (mail_cc_excluded boolean)
-- 백업요청 메일은 요청자와 같은 팀의 active 운영자 전원을 자동 CC — 이 플래그가 true인
-- 운영자는 active·팀 소속을 유지한 채로 그 자동 CC에서 제외된다. 조직권한 인스펙터에서 토글.
--
-- Supabase Dashboard SQL Editor 전체 선택 후 한 번에 RUN:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql

begin;

alter table public.operators
  add column if not exists mail_cc_excluded boolean not null default false;

commit;

------------------------------------------------------------
-- PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select name, email, team, status, mail_cc_excluded
--   from public.operators
--   where mail_cc_excluded = true;
-- 기대: 초기 적용 직후 0건 (전원 default false — 자동 CC 포함 유지)
