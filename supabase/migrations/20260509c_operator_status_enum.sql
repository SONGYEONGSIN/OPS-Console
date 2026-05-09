-- operators 상태 enum 재정의 + 삭제 사유 / 시각 컬럼 추가
--
-- Supabase Dashboard SQL Editor에서 실행:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql

------------------------------------------------------------
-- 1) 기존 데이터 매핑 (안전 장치)
------------------------------------------------------------

update public.operators set status = 'active'    where status = 'approved';
update public.operators set status = 'inactive'  where status = 'review';
update public.operators set status = 'suspended' where status = 'urgent';

------------------------------------------------------------
-- 2) status CHECK constraint 재정의
------------------------------------------------------------

alter table public.operators drop constraint if exists operators_status_check;
alter table public.operators add constraint operators_status_check
  check (status in ('active', 'inactive', 'suspended', 'deleted'));

------------------------------------------------------------
-- 3) 삭제 사유 + 시각 컬럼 추가
------------------------------------------------------------

alter table public.operators
  add column if not exists deleted_reason text,
  add column if not exists deleted_at timestamptz;

------------------------------------------------------------
-- 4) 인덱스 (활성/삭제 분리 조회 최적화)
------------------------------------------------------------

create index if not exists operators_status_idx_v2
  on public.operators (status)
  where status <> 'deleted';
