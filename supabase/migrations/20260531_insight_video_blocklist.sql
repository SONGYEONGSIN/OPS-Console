-- 인사이트 영상 차단 목록 (insight_video_blocklist)
-- ai-insight에서 admin이 삭제한 영상의 video_id를 영구 보관 → 수집 cron이 재적재하지 않음.
-- insight_videos cleanup(60일)과 무관하게 영구 유지되어야 하므로 별도 테이블로 분리.
-- 정책: SELECT 운영부 전체 read / INSERT·UPDATE·DELETE 정책 없음 → authenticated 차단.
-- 쓰기는 service_role(RLS bypass) — deleteInsightVideo server action(admin client)이 사용.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.insight_video_blocklist (
  video_id    text primary key,                          -- YouTube 영상 ID (insight_videos.video_id)
  title       text,                                       -- 차단 당시 제목 (참고용)
  blocked_by  text,                                       -- 차단한 운영자 이메일
  blocked_at  timestamptz not null default now()
);

create index if not exists insight_video_blocklist_blocked_at_desc_idx
  on public.insight_video_blocklist (blocked_at desc);

------------------------------------------------------------
-- 2) RLS — select 전원 read / 쓰기 service_role 전용
------------------------------------------------------------

alter table public.insight_video_blocklist enable row level security;

drop policy if exists "insight_video_blocklist_select_all" on public.insight_video_blocklist;
create policy "insight_video_blocklist_select_all"
  on public.insight_video_blocklist for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated는 RLS로 자동 차단
-- service_role은 RLS bypass라 server action/cron이 그대로 쓰기 가능

grant select on public.insight_video_blocklist to authenticated;
grant all on public.insight_video_blocklist to service_role;

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.insight_video_blocklist
-- 기대: 4 컬럼 (video_id, title, blocked_by, blocked_at)
-- select policyname, cmd from pg_policies where tablename = 'insight_video_blocklist';
-- 기대: 1 정책 (select_all)
