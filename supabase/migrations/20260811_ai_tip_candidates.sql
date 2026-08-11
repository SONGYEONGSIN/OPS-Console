-- ai_tip_candidates — GitHub 급상승 리포 수집 후보.
-- 회사 PC 수집기가 적재하고, 사람이 TIP 페이지에서 등록(promoted)하거나 숨긴다(hidden).
-- draft_*가 전부 nullable인 것은 의도 — claude 초안 생성이 실패해도 리포 정보만으로 후보를 남긴다.
-- 수집을 통째로 버리면 그 주 리포를 영영 놓친다.

begin;

create table if not exists public.ai_tip_candidates (
  id                  uuid primary key default gen_random_uuid(),
  repo_full_name      text not null unique,
  repo_url            text not null,
  stars               integer not null default 0,
  repo_description    text,
  draft_title         text,
  draft_summary_md    text,
  draft_reuse_prompt  text,
  draft_tags          text[] not null default '{}',
  draft_ai_tool       text,
  draft_category      text,
  status              text not null default 'pending',
  collected_at        timestamptz not null default now(),
  -- 컬럼 인라인 대신 테이블 레벨 제약 — team_briefings 마이그레이션과 같은 형태.
  constraint ai_tip_candidates_status_check
    check (status in ('pending', 'promoted', 'hidden'))
);

-- 후보 패널은 pending만 최신순으로 읽는다.
create index if not exists ai_tip_candidates_status_collected_idx
  on public.ai_tip_candidates (status, collected_at desc);

alter table public.ai_tip_candidates enable row level security;

-- read: 인증 전원 (TIP 페이지에서 본다)
drop policy if exists ai_tip_candidates_read on public.ai_tip_candidates;
create policy ai_tip_candidates_read on public.ai_tip_candidates
  for select to authenticated using (true);

-- update: 인증 전원 (승인·숨김은 사람이 웹에서 누른다)
drop policy if exists ai_tip_candidates_update on public.ai_tip_candidates;
create policy ai_tip_candidates_update on public.ai_tip_candidates
  for update to authenticated using (true) with check (true);

grant select, update on public.ai_tip_candidates to authenticated;
grant all on public.ai_tip_candidates to service_role;

commit;

notify pgrst, 'reload schema';
