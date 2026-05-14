-- backup_request_services — backup_requests ↔ services N:M join table
-- 핵심: services.id (uuid) FK 참조 + ON DELETE CASCADE 양쪽
-- 사이드 effect: services row 삭제 시 join row 자동 정리, backup_request 삭제도 동일
-- PR-2: backup_requests.services text[] chips를 정규화된 FK 관계로 진화 (#92 plan)
-- RLS는 별도 20260521b (parent backup_requests 정책 mirror)

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.backup_request_services (
  backup_request_id  uuid not null
                     references public.backup_requests(id) on delete cascade,
  service_id         uuid not null
                     references public.services(id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (backup_request_id, service_id)
);

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

-- composite PK가 (backup_request_id, service_id)이므로 left-prefix 쿼리는 PK 인덱스로 충분.
-- 반대 방향(services.id 기준 join row 조회 — 예: "이 service를 참조하는 backup_requests")용 단일 idx.
create index if not exists backup_request_services_service_id_idx
  on public.backup_request_services (service_id);

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- \d public.backup_request_services
-- 기대: 4 컬럼 + composite PK + 2 FK + 1 idx
--
-- select count(*) from public.backup_request_services;
-- 기대: 0 (신규 테이블)
--
-- ON DELETE CASCADE 검증 시나리오 (수동):
-- 1) 임시 backup_request + 2 join row insert
-- 2) delete backup_requests where id = ... → join row 0건 확인
-- 3) services row 삭제 시 동일하게 join row 자동 제거
