-- backup_request_services — closing(서비스 마감) 소스 전환
-- 변경: service_id uuid(services.id FK) → bigint(모아 service_id) + university_name/service_name 스냅샷.
-- 이유: 백업 서비스 후보를 services 목록 → closing_services로 전환. closing 서비스는 services.id(uuid)가
--       없어(service_id 겹침 0%) 기존 FK로 참조 불가. service_id(int) + 스냅샷으로 참조 방식 변경.
-- 안전성: backup_request_services·backup_requests 모두 0행 — 데이터 마이그 불필요, drop+recreate 안전.
-- RLS/GRANT는 원본(20260521b) 정책을 그대로 재현 (drop으로 사라지므로 재생성 필수).

begin;

------------------------------------------------------------
-- 1) 기존 테이블 제거 (0행 — 데이터 손실 없음). 정책/FK/idx/grant 함께 제거됨.
------------------------------------------------------------

drop table if exists public.backup_request_services cascade;

------------------------------------------------------------
-- 2) 테이블 재생성 — service_id bigint + 스냅샷(university_name/service_name), services FK 없음
------------------------------------------------------------

create table public.backup_request_services (
  backup_request_id  uuid not null
                     references public.backup_requests(id) on delete cascade,
  service_id         bigint not null,
  university_name    text not null,
  service_name       text not null,
  created_at         timestamptz not null default now(),
  substitute_email   text,
  substitute_name    text,
  note_md            text,
  contacts           jsonb not null default '[]'::jsonb,
  primary key (backup_request_id, service_id)
);

------------------------------------------------------------
-- 3) 인덱스 — service_id 기준 역방향 조회용 (원본 동일)
------------------------------------------------------------

create index if not exists backup_request_services_service_id_idx
  on public.backup_request_services (service_id);

------------------------------------------------------------
-- 4) RLS — 원본 20260521b 정책 재현 (select 전원 / insert·delete = admin OR 본인 requester)
------------------------------------------------------------

alter table public.backup_request_services enable row level security;

drop policy if exists "backup_request_services_select_all" on public.backup_request_services;
create policy "backup_request_services_select_all"
  on public.backup_request_services for select
  to authenticated
  using (true);

drop policy if exists "backup_request_services_insert" on public.backup_request_services;
create policy "backup_request_services_insert"
  on public.backup_request_services for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.backup_requests br
      where br.id = backup_request_id
        and br.requester_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "backup_request_services_delete" on public.backup_request_services;
create policy "backup_request_services_delete"
  on public.backup_request_services for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.backup_requests br
      where br.id = backup_request_id
        and br.requester_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 5) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, delete on public.backup_request_services to authenticated;
grant all on public.backup_request_services to service_role;

------------------------------------------------------------
-- 6) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- \d public.backup_request_services
-- 기대: service_id bigint + university_name/service_name text not null, services FK 없음
-- select policyname, cmd from pg_policies where tablename = 'backup_request_services'; → 3개
-- has_table_privilege('authenticated','public.backup_request_services','INSERT') → t
