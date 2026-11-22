-- 주간업무보고 작성 포함 — 직급(부장·팀장) 때문에 기본으로 빠지는 사람을 작성 대상에 넣는 예외 목록.
-- 직급을 바꾸지 않는다(다른 화면이 직급을 쓴다). 제외 목록(excluded_writer_emails)이 이 목록보다 앞선다.
alter table public.ops_weekly_settings
  add column if not exists included_writer_emails text[] not null default '{}';
