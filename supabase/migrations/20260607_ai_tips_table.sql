-- TIP 공유 (ai-tips) 도메인 — AI & 자동화 그룹 (slug `ai-tips`)
-- 운영부 공통 AI 활용 팁/프롬프트 자산. my-ai-work와 별개:
--   * my-ai-work = 활용 사례 회고 (긴 글 + 시점 + 효과 측정)
--   * ai_tips    = 단편 팁 (짧음 + 시점 무관 + reuse_prompt 필수)
-- 정책: 모든 운영자 read / 본인 글만 modify (RLS 별도 20260607b)

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.ai_tips (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null check (char_length(title) <= 80),
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
  summary_md      text not null check (char_length(summary_md) <= 500),  -- 1~3줄 짧은 설명
  reuse_prompt    text not null,                                         -- TIP의 핵심 — 1-click 복사
  tags            text[] not null default '{}',
  author_email    text not null,
  author_id       uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists ai_tips_set_updated_at on public.ai_tips;
create trigger ai_tips_set_updated_at
before update on public.ai_tips
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists ai_tips_author_email_idx
  on public.ai_tips (author_email);

create index if not exists ai_tips_created_at_desc_idx
  on public.ai_tips (created_at desc);

create index if not exists ai_tips_ai_tool_idx
  on public.ai_tips (ai_tool);

create index if not exists ai_tips_category_idx
  on public.ai_tips (category);

commit;

notify pgrst, 'reload schema';
