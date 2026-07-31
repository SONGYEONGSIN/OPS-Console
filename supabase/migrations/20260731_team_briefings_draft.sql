-- 팀 브리핑 초안(draft) 단계 — 사람이 내용을 확인한 뒤 발행하도록 분리한다.
-- 기존 행은 default 'published'로 남아 그대로 발행분으로 취급된다.
alter table public.team_briefings
  add column if not exists status text not null default 'published',
  add column if not exists published_at timestamptz;

alter table public.team_briefings
  drop constraint if exists team_briefings_status_check;
alter table public.team_briefings
  add constraint team_briefings_status_check
  check (status in ('draft', 'published'));

-- 초안은 동시에 1건만 존재한다 (새 초안이 이전 초안을 대체).
create unique index if not exists team_briefings_single_draft_idx
  on public.team_briefings (status) where status = 'draft';
