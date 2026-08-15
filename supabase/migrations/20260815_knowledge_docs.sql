-- knowledge_docs — 업무 지식망(SharePoint 옵시디언 볼트) 검색 인덱스
--
-- 원본은 마크다운 파일이고 이 테이블은 사본이다. 갈라지면 파일이 이긴다 —
-- 볼트에서 사라진 path는 인덱서가 여기서도 지운다.
-- 쓰기는 인덱스 잡이 service_role로만. 읽기는 운영부 전체(열람 화면·어시스턴트).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.knowledge_docs (
  id                uuid primary key default gen_random_uuid(),
  -- '플레이북/경위서 발송 절차.md' — 볼트 안의 상대 경로가 곧 식별자
  path              text not null unique,
  -- 폴더명. frontmatter가 아니라 실제 위치가 사실이다.
  category          text not null,
  title             text not null,
  owner             text,
  updated           date,
  related           text[] not null default '{}',
  body              text not null default '',
  -- 변경분만 갱신하기 위한 원문 해시
  content_hash      text not null,
  graph_item_id     text not null,
  -- 비어 있거나 없는 frontmatter 필드. '고칠 목록'으로 쓴다.
  missing           text[] not null default '{}',
  -- frontmatter category가 폴더와 어긋난 문서
  category_mismatch boolean not null default false,
  indexed_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

-- 트리 렌더 — 분류별 묶음
create index if not exists knowledge_docs_category_idx
  on public.knowledge_docs (category, title);

-- 형식 미비 목록 — 누락이 있는 문서만
create index if not exists knowledge_docs_missing_idx
  on public.knowledge_docs (category)
  where array_length(missing, 1) is not null;

-- 신선도 경고 — 오래된 문서 조회
create index if not exists knowledge_docs_updated_idx
  on public.knowledge_docs (updated);

------------------------------------------------------------
-- 3) RLS — read 운영부 전체 / write service_role only (인덱스 잡)
------------------------------------------------------------

alter table public.knowledge_docs enable row level security;

drop policy if exists "knowledge_docs_select_all" on public.knowledge_docs;
create policy "knowledge_docs_select_all"
  on public.knowledge_docs
  for select
  to authenticated
  using (true);

grant select on public.knowledge_docs to authenticated;
grant all on public.knowledge_docs to service_role;

commit;

-- 검증
-- select count(*) from public.knowledge_docs;
-- select policyname, cmd from pg_policies where tablename = 'knowledge_docs'; → 1 (select)
