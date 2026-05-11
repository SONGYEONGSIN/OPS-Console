-- 내 작업 (my-ai-work) 도메인 — AI 활용 등록 메뉴
-- 사이드바: '분석 · AI' > 'AI & 자동화' > '내 작업' (slug `my-ai-work`)
-- 정책 핵심: 모든 운영자 read / 본인 작성 항목만 modify (RLS는 별도 20260517b)
-- author_email 기반 (posts/todos 패턴 일관)

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.ai_work (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null check (char_length(title) <= 120),
  work_date       date not null,                              -- 작업 일자 (자유 입력)
  ai_tool         text not null
                  check (ai_tool in (
                    'claude', 'chatgpt', 'gemini', 'cursor',
                    'copilot', 'notion_ai', 'etc'
                  )),
  category        text not null
                  check (category in (
                    'code', 'doc', 'analysis', 'design',
                    'translation', 'meeting', 'automation', 'etc'
                  )),
  summary_md      text not null,                              -- 요약 (markdown)
  output_url      text,                                       -- 결과물 링크 (Notion/GDocs/GitHub/Drive)
  reuse_prompt    text,                                       -- 재사용 프롬프트 (핵심 가치)
  saved_hours     numeric(5,1) check (saved_hours is null or saved_hours >= 0),
  tags            text[] not null default '{}',
  author_email    text not null,                              -- 등록자 (operators.email)
  author_id       uuid,                                       -- best-effort (auth.users.id)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at 자동 (operators 마이그레이션의 set_updated_at 함수 재사용)
drop trigger if exists ai_work_set_updated_at on public.ai_work;
create trigger ai_work_set_updated_at
before update on public.ai_work
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists ai_work_author_email_idx
  on public.ai_work (author_email);

create index if not exists ai_work_work_date_desc_idx
  on public.ai_work (work_date desc, created_at desc);

create index if not exists ai_work_ai_tool_idx
  on public.ai_work (ai_tool);

create index if not exists ai_work_category_idx
  on public.ai_work (category);

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.ai_work
-- 기대: 14 컬럼 (id, title, work_date, ai_tool, category, summary_md,
--                output_url, reuse_prompt, saved_hours, tags,
--                author_email, author_id, created_at, updated_at)
-- select indexname from pg_indexes where tablename='ai_work' order by 1;
-- 기대: 4 user index + 1 pkey
