-- 운영부 뉴스 (news) 도메인 — 대학 관련 뉴스 멀티소스 RSS 자동 수집
-- 사이드바: '개요' > '운영부 뉴스' (slug `news`, pattern `list`)
-- 정책 핵심: 운영부 전체 read / 쓰기는 service_role 전용 (news-collect 잡)
-- 쓰기 RLS는 별도 20260623b — INSERT/UPDATE/DELETE 정책 없음 → authenticated 차단

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.news (
  id            uuid primary key default uuid_generate_v4(),
  link          text not null unique,        -- 원문(또는 구글 리다이렉트) URL — dedupe 키
  title         text not null,               -- 기사 제목
  source        text,                         -- 언론사명 (RSS <source>에서 추출)
  published_at  timestamptz,                  -- 기사 게시일 (RFC2822 → ISO 변환 후 저장)
  summary       text,                         -- description HTML 제거 스니펫
  keyword       text,                         -- 수집에 사용된 검색 키워드
  collected_at  timestamptz not null default now()
);

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

-- link는 unique 제약으로 자동 인덱스 생성됨
create index if not exists news_published_at_desc_idx
  on public.news (published_at desc);

create index if not exists news_keyword_idx
  on public.news (keyword);

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.news
-- 기대: 8 컬럼 (id, link, title, source, published_at, summary, keyword, collected_at)
-- select indexname from pg_indexes where tablename='news' order by 1;
-- 기대: 2 user index + 1 pkey + 1 unique (link)
