-- 운영자별 메뉴 접근 권한 (allowed_menus text[])
-- admin은 bypass — allowed_menus는 빈 배열로 두고 클라이언트/서버 가드에서 permission='admin'을 자동 통과시킴.
-- TL·매니저(member)는 직급 기반 디폴트로 운영+정보+분석+프로젝트 메뉴 분배. team/settings는 admin 전용이라 제외.
--
-- Supabase Dashboard SQL Editor 전체 선택 후 한 번에 RUN:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql

begin;

------------------------------------------------------------
-- 1) allowed_menus 컬럼
------------------------------------------------------------

alter table public.operators
  add column if not exists allowed_menus text[] not null default '{}';

------------------------------------------------------------
-- 2) admin (부장·팀장) — 빈 배열 (bypass)
------------------------------------------------------------

update public.operators
  set allowed_menus = '{}'
  where role in ('부장', '팀장');

------------------------------------------------------------
-- 3) member (TL·매니저) — 운영+정보+분석+프로젝트 (team/settings 제외)
------------------------------------------------------------

update public.operators
  set allowed_menus = ARRAY[
    -- 운영
    'alerts','my-todo','schedule','handover',
    'data-requests','incidents','contacts','backup','vault',
    -- 서비스 사이클
    'services','contracts','dev-test','deploy',
    'closing','settlement','invoice','receivables',
    -- 프로젝트
    'pims','reception-admin','internal-admin','competition',
    'generator','revenue','jh-cash','k12','kcue',
    'referral','guarantee','performance',
    -- 분석·보고
    'worklog','outcomes','reports',
    -- AI
    'ai-insight','ai-assistant','my-ai-work','ai-tips',
    -- 정보·매뉴얼
    'manual','sop','vibe-coding','meetings','faq',
    -- 게시판
    'onboarding','feedback','notices'
  ]
  where role in ('TL', '매니저');

------------------------------------------------------------
-- 4) GIN 인덱스 (배열 contains 검색용)
------------------------------------------------------------

create index if not exists operators_allowed_menus_idx
  on public.operators using gin (allowed_menus);

commit;

------------------------------------------------------------
-- 5) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select role, array_length(allowed_menus, 1) as menu_count
--   from public.operators
--   group by role, array_length(allowed_menus, 1)
--   order by 1;
-- 기대: 부장 0(NULL) 1명 / 팀장 0(NULL) 1명 / TL 41 2명 / 매니저 41 13명
