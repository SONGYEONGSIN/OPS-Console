-- 공지 공지일(announce_on) — 이 날짜에 Teams로 1회 공유. null = 작성 즉시(현행).
-- notice-teams-share 잡이 announce_on <= 오늘(또는 null)인 미공유 공지만 발송한다.
begin;

alter table public.posts
  add column if not exists announce_on date;

commit;
