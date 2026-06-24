-- 공지 Teams 공유 멱등 마커 — notice_shared_at(공유 완료 시각). null = 미공유.
-- notice-teams-share 잡이 미공유 공지를 탐지해 Teams 발송 후 이 컬럼을 채운다.
begin;

alter table public.posts
  add column if not exists notice_shared_at timestamptz;

-- 배포 시점에 이미 존재하는 공지는 '공유됨'으로 표시 — 과거 백로그 일괄 발송 방지.
update public.posts
  set notice_shared_at = now()
  where domain = 'notice' and notice_shared_at is null;

-- 미공유 공지 탐지용 부분 인덱스.
create index if not exists posts_notice_unshared_idx
  on public.posts (created_at)
  where domain = 'notice' and notice_shared_at is null;

commit;
