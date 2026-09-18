-- 판정 요청 큐 — 서버 잡이 적재하고 회사 PC 폴러가 claim 한다(설계 §6.4).
--
-- 판정이 Agent SDK 이고 서버에는 LLM 호출 경로가 없다(§4). 그래서 경쟁률 점검과
-- 같은 구조다: 서버 잡은 **요청을 적재**하고 회사 PC 가 **claim 해 판정**한다.
-- 이 구조의 값은 서버 잡이 매일 돌아 기록을 남긴다는 점이다 — PC 가 꺼져 있어도
-- 적재는 계속되므로 PC 중단이 '조용한 무동작' 이 아니라 **pending 적체**로 드러난다.
--
-- 모양은 `ratio_audit_requests`(20260803)를 그대로 따른다. 다른 것은 셋이다:
-- 학년도·종류·단건 대상, 그리고 판정 결과로 생긴 배치를 가리키는 `batch_id`.

create table if not exists public.assignment_propose_requests (
  id              uuid primary key default gen_random_uuid(),
  requested_at    timestamptz not null default now(),
  -- 'automation'(cron) 또는 관리자 이메일. 자동화 경로에는 세션이 없다.
  requested_by    text not null,
  academic_year   smallint not null,
  -- 제안 배치의 kind 와 같은 어휘다(`assignment_proposal_batches`).
  kind            text not null check (kind in ('annual', 'single')),
  -- 단건 요청의 대상. annual 은 학년도 전체라 대상이 없다.
  university_name text,
  work_kind       text,
  status          text not null default 'pending'
                  check (status in ('pending', 'running', 'done', 'failed')),
  claimed_at      timestamptz,
  finished_at     timestamptz,
  -- 판정이 만든 배치. 요청만 보고도 결과로 건너갈 수 있어야 한다.
  -- 배치가 지워지면 요청 이력은 남기고 연결만 끊는다.
  batch_id        uuid references public.assignment_proposal_batches(id)
                    on delete set null,
  message         text,
  created_at      timestamptz not null default now(),
  -- **대상 없는 단건 요청을 막는다.** 폴러가 무엇을 판정할지 모르는 채로 claim 하면
  -- 그 요청은 실패로만 끝나고, 애초에 만들어진 이유를 아무도 알 수 없다.
  constraint assignment_propose_requests_target_chk check (
    (kind = 'single'
       and university_name is not null and work_kind is not null)
    or (kind = 'annual'
       and university_name is null and work_kind is null)
  )
);

-- claim 은 '가장 오래된 pending' 을 찾는다 — 그 한 조회가 큐의 뜨거운 자리다.
create index if not exists assignment_propose_requests_status_idx
  on public.assignment_propose_requests (status, requested_at);

alter table public.assignment_propose_requests enable row level security;

-- 제안은 admin 만 본다(§9.5). 큐도 같은 선에 둔다 — 요청 자체가 '누가 언제 무엇을
-- 판정하게 했나' 라서 제안과 같은 정보다.
--
-- `is_admin()` 을 **감싸서** 부른다. 맨 호출은 행마다 평가돼 6000행에서 696ms 가
-- 걸렸다(20260510b 선례).
drop policy if exists assignment_propose_requests_select on public.assignment_propose_requests;
create policy assignment_propose_requests_select
  on public.assignment_propose_requests
  for select to authenticated
  using ((select public.is_admin()));

-- 쓰기 정책은 두지 않는다. 적재·claim·완료 보고는 모두 service_role 이다.
grant select on public.assignment_propose_requests to authenticated;
grant all on public.assignment_propose_requests to service_role;

notify pgrst, 'reload schema';
