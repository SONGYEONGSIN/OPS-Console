-- automation_runs — 자동화 잡 실행 공통 로그.
-- 기존엔 잡별 결과 테이블(*_mail_sends 등) 역산이라, 실행됐지만 발송 0건이면
-- "마지막 실행"이 갱신되지 않고 실행 자체도 기록되지 않았다.
-- cron route / 수동 action의 모든 job.run() 호출(실행·스킵·실패)을 1건씩 적재한다.

begin;

create table if not exists public.automation_runs (
  id          uuid primary key default gen_random_uuid(),
  job_id      text not null,
  ran_at      timestamptz not null default now(),
  ok          boolean not null,
  skipped     boolean not null default false,        -- 자동 실행 OFF로 cron이 스킵한 호출
  message     text,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

-- 잡별 최신 조회(마지막 실행 + 실행 로그)용
create index if not exists automation_runs_job_ran_idx
  on public.automation_runs (job_id, ran_at desc);
create index if not exists automation_runs_ran_at_idx
  on public.automation_runs (ran_at desc);

notify pgrst, 'reload schema';

commit;
