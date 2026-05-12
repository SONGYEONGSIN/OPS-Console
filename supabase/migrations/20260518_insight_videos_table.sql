-- 인사이트 (ai-insight) 도메인 — YouTube 바이브코딩 영상 자동 수집
-- 사이드바: 'AI & 자동화' > '인사이트' (slug `ai-insight`)
-- 정책 핵심: 운영부 전체 read / 쓰기는 service_role 전용 (cron 스크립트)
-- 쓰기 RLS는 별도 20260518b — INSERT/UPDATE/DELETE 정책 없음 → authenticated 차단

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.insight_videos (
  id              uuid primary key default uuid_generate_v4(),
  video_id        text not null unique,                         -- YouTube 영상 ID (dedupe 키)
  title           text not null,                                -- YouTube 제목
  channel_title   text not null,                                -- 채널명
  thumbnail_url   text not null,                                -- medium (320x180)
  published_at    timestamptz not null,                         -- YouTube 게시일
  view_count      bigint,                                       -- 수집 시점 조회수 (선택)
  keyword         text not null,                                -- 매칭된 키워드 (예: '바이브코딩', 'cursor')
  description     text,                                         -- 처음 200자 (선택)
  collected_at    timestamptz not null default now()
);

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

-- video_id는 unique 제약으로 자동 인덱스 생성됨
create index if not exists insight_videos_published_at_desc_idx
  on public.insight_videos (published_at desc);

create index if not exists insight_videos_keyword_idx
  on public.insight_videos (keyword);

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.insight_videos
-- 기대: 10 컬럼 (id, video_id, title, channel_title, thumbnail_url,
--                published_at, view_count, keyword, description, collected_at)
-- select indexname from pg_indexes where tablename='insight_videos' order by 1;
-- 기대: 2 user index + 1 pkey + 1 unique (video_id)
