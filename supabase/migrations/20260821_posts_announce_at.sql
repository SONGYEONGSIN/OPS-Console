-- 공지 예약을 날짜에서 **시각**으로.
--
-- 지금까지는 announce_on(date) 이라 '9/7에 공지'까지만 정할 수 있었다. 그런데
-- notice-teams-share 잡이 30분 간격으로 돌아, 날짜만 맞으면 그날 첫 실행
-- (00:00~00:30)에 나가버린다. 아침 9시에 알리고 싶은 공지가 새벽에 나갔다.
--
-- 기존 값은 그날 00:00(KST)로 옮긴다 — 지금 동작과 정확히 같다. 그 날짜로
-- 잡혀 있던 공지는 어차피 그날 첫 실행에 나갔을 것이다.
--
-- 이름도 함께 바꾼다. 'on'은 날짜를 뜻해 시각이 담기면 읽는 사람이 오해한다.
begin;

alter table public.posts
  alter column announce_on type timestamptz
    using (announce_on::timestamp at time zone 'Asia/Seoul');

alter table public.posts
  rename column announce_on to announce_at;

commit;
