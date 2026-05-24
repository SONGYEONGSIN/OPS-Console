-- 성과리포트 — 평가 사이클 (performance_cycles)
-- 8단계 평가 워크플로우(목표설정→...→완료)의 컨테이너.
-- 사이클 1건 = 진학사 운영부 평가 1주기 (예: "2026 상반기").
-- RLS는 별도 마이그레이션(20260610b).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.performance_cycles (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,                                        -- 자유 텍스트 (예: '2026 상반기')
  status      text not null default 'open'
              check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint performance_cycles_name_unique unique (name)
);

-- updated_at 자동 (set_updated_at 함수는 operators 마이그레이션에서 정의됨)
drop trigger if exists performance_cycles_set_updated_at on public.performance_cycles;
create trigger performance_cycles_set_updated_at
before update on public.performance_cycles
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists performance_cycles_status_idx
  on public.performance_cycles (status);

create index if not exists performance_cycles_created_at_idx
  on public.performance_cycles (created_at desc);

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select count(*), status from public.performance_cycles group by status;
