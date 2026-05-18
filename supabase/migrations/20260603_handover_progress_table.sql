-- handover_progress: 인수인계 진행 이력 (PR-B)
-- service 1:N (한 service에 여러 차례 인계 가능). brainstorm 메모 그대로.

begin;

create table if not exists public.handover_progress (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services(id) on delete cascade,
  -- 인계자(from) — 본인 (server action에서 getCurrentOperator)
  from_email    text not null,
  from_name     text not null,
  -- 인수자(to) — wizard step2에서 선택
  to_email      text not null,
  to_name       text not null,
  -- 진행 상태
  status        text not null default 'in_progress'
                  check (status in ('in_progress','completed','cancelled')),
  -- 메모 — wizard step3 자유 입력
  notes         text,
  -- 인수 확인 시각 (status=completed 시 채움)
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists handover_progress_service_idx
  on public.handover_progress (service_id);
create index if not exists handover_progress_to_idx
  on public.handover_progress (to_email);
create index if not exists handover_progress_created_idx
  on public.handover_progress (created_at desc);

-- updated_at trigger (다른 테이블 패턴 동일)
create or replace function public.handover_progress_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists handover_progress_set_updated_at on public.handover_progress;
create trigger handover_progress_set_updated_at
  before update on public.handover_progress
  for each row execute function public.handover_progress_set_updated_at();

commit;

notify pgrst, 'reload schema';
