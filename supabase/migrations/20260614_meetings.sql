-- meetings — 회의록 도메인. 유형(템플릿) 선택 → 노션형 블록 본문(content jsonb).
-- 경위서 패턴 기반이나 승인체인·시행번호·incidents 종속 제외.

begin;

create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  type          text not null
                check (type in ('regular','field','project','memo','urgent')),
  title         text not null default '제목 없음',
  meeting_date  timestamptz,
  location      text,
  attendees     jsonb not null default '[]',
  author_email  text not null,
  status        text not null default 'draft'
                check (status in ('draft','sent')),
  content       jsonb not null default '[]',
  sharepoint_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meetings_type_idx       on public.meetings (type);
create index if not exists meetings_status_idx      on public.meetings (status);
create index if not exists meetings_created_at_idx  on public.meetings (created_at desc);
create index if not exists meetings_author_idx      on public.meetings (author_email);

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
