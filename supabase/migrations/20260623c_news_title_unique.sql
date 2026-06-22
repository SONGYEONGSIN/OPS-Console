-- 운영부 뉴스 (news) — dedupe 키 link → title 전환
-- 근거: 같은 기사가 수집 키워드마다 다른 구글 뉴스 link로 잡혀 link-unique로는
--       중복이 차단되지 않음 (예: 478행 / 고유 title 475). 같은 기사 = 같은 title.
-- news-collect 잡의 upsert onConflict도 "link" → "title"로 함께 전환됨.
-- 스타일: 20260623_news_table.sql 참고 (begin/commit + notify pgrst).

begin;

------------------------------------------------------------
-- 1) 기존 title 중복 제거 (collected_at 최신 1건만 유지)
------------------------------------------------------------

-- (collected_at, id) 복합 비교로 동률(같은 수집 실행 = 동일 collected_at)에도
-- id(uuid) tiebreaker로 정확히 1건만 생존. collected_at 단독 비교는 동률 시
-- 양쪽 다 미삭제 → unique 인덱스 생성 실패.
delete from public.news a using public.news b
  where a.title = b.title
    and (a.collected_at, a.id) < (b.collected_at, b.id);

------------------------------------------------------------
-- 2) unique 키 link → title 전환
------------------------------------------------------------

-- link unique 제약 실제 이름: news_link_key (Postgres 기본 명명 <table>_<col>_key)
alter table public.news drop constraint if exists news_link_key;
alter table public.news add constraint news_title_unique unique (title);

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid='public.news'::regclass and contype='u';
-- 기대: news_title_unique UNIQUE (title) (news_link_key 없음)
