-- 운영자 시스템 권한 컬럼 (admin / member / viewer)
-- 직급(role)과 별개의 시스템 권한 — 시드 단계에서 직급 기반으로 backfill 후
-- 이후엔 admin이 UI에서 자유롭게 변경.
--
-- Supabase Dashboard SQL Editor에서 전체 선택 후 한 번에 RUN:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql

begin;

------------------------------------------------------------
-- 1) permission 컬럼 (기본 member, CHECK enum)
------------------------------------------------------------

alter table public.operators
  add column if not exists permission text not null default 'member'
    check (permission in ('admin', 'member', 'viewer'));

------------------------------------------------------------
-- 2) 시드 backfill — 부장·팀장 → admin
--    (TL·매니저는 default 'member' 그대로)
------------------------------------------------------------

update public.operators
  set permission = 'admin'
  where role in ('부장', '팀장');

------------------------------------------------------------
-- 3) 인덱스
------------------------------------------------------------

create index if not exists operators_permission_idx
  on public.operators (permission);

commit;

------------------------------------------------------------
-- 4) PostgREST schema cache 강제 reload
--    (트랜잭션 외부 — notify는 commit 시점에 발송)
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 쿼리 (실행 후 수동 확인):
-- select role, permission, count(*) from public.operators group by role, permission order by 1, 2;
-- 기대 결과: 부장(admin)1, 팀장(admin)1, TL(member)2, 매니저(member)13. viewer 0.
