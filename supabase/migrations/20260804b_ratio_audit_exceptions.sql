-- 경쟁률 점검 예외 — '설정은 다르지만 합의된 정상'을 알림에서 제외한다.
--
-- 연세대(서울) 수시 1차 재현: 문구는 9/9 3회 공개(10:00, 15:00, 18:00)인데 스케줄에는
-- 18시가 없다. 원서접수 마감이 17시라 마감 후 18시 공개는 내부 수동으로 진행하기로
-- 합의된 건이라 오설정이 아니다. 이런 건이 매 실행마다 발송되면 알림이 무뎌지고
-- 진짜 오설정이 묻힌다.
--
-- 판정(payload)에는 그대로 남기고 '발송'에서만 뺀다 — 예외를 잘못 등록해도 이력은
-- 보존되고, 나중에 몇 건이 걸러졌는지 추적할 수 있다.

begin;

create table if not exists public.ratio_audit_exceptions (
  id          uuid primary key default gen_random_uuid(),
  service_id  integer not null,
  -- null = 모든 차수. 같은 serviceId라도 1차/2차가 별도 설정 페이지라 차수를 구분할 수 있게 둔다.
  seq         integer,
  -- 왜 정상인지 — 나중에 이 예외를 지워야 할지 판단하는 근거다. 빈 값 금지.
  reason      text not null check (length(btrim(reason)) > 0),
  created_by  text not null,
  created_at  timestamptz not null default now()
);

-- 같은 대상에 예외가 중복 등록되지 않게. seq null은 -1로 접어 비교한다.
create unique index if not exists ratio_audit_exceptions_target_idx
  on public.ratio_audit_exceptions (service_id, coalesce(seq, -1));

-- RLS — read: authenticated 전체(운영부 공개) / write: service_role only.
-- ratio_audit_runs 와 동일 정책.
alter table public.ratio_audit_exceptions enable row level security;

drop policy if exists "ratio_audit_exceptions_read_authenticated"
  on public.ratio_audit_exceptions;
create policy "ratio_audit_exceptions_read_authenticated"
  on public.ratio_audit_exceptions for select to authenticated using (true);

grant select on public.ratio_audit_exceptions to authenticated;
grant all on public.ratio_audit_exceptions to service_role;

notify pgrst, 'reload schema';

commit;

-- 등록 예시 (수동):
-- insert into public.ratio_audit_exceptions (service_id, seq, reason, created_by)
-- values (1234567, 1, '접수 마감 17시, 마감 후 18시 공개는 내부 수동 진행 합의', 'ys1114@jinhakapply.com');
