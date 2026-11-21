-- 요강이(jinhak-inspect 점검표 보기 HTML) 장별 메모.
-- 설계: jinhak-inspect docs/superpowers/specs/2026-11-06-yogang-memo-design.md
--
-- 운영1 · 2팀이 요강이 화면에서 anon 키로 쓰고 읽는다(로그인 없음 — HTML 은 팀즈 파일로 열린다).
-- jinhak-inspect 의 회차(service_role)가 팀즈 「2027 수시2차 메모.xlsx」 로 옮겨 적고, 요강이(Claude)가 처리 상태를 적는다.
-- anon 은 이 표만 select · insert — update · delete 는 없다(쓴 사람을 지킬 수 없어 고치기 · 지우기를 두지 않는다).

begin;

create table if not exists public.s2_memos (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  univ        text not null check (char_length(univ) between 1 and 100),
  sheet       text not null check (sheet ~ '^[0-9]{2}$'),
  kind        text not null check (kind in ('기억용', '요강이 처리')),
  body        text not null check (char_length(body) between 1 and 2000),
  author      text not null check (char_length(author) between 1 and 50),
  status      text not null default '새 메모' check (status in ('새 메모', '처리함', '확인 필요', '취소', '처리 제안')),
  reply       text check (reply is null or char_length(reply) <= 4000),
  handled_at  timestamptz
);

create index if not exists s2_memos_univ_created on public.s2_memos (univ, created_at desc);

alter table public.s2_memos enable row level security;
revoke all on public.s2_memos from public, anon, authenticated;
grant select, insert on public.s2_memos to anon;
grant all on public.s2_memos to service_role;

-- 읽기는 모두(메모는 팀 안에서 함께 본다), 쓰기는 새 메모만 — 상태 · 요강이 답 · 처리 시각은 service_role 만 적는다.
create policy s2_memos_anon_read on public.s2_memos for select to anon using (true);
create policy s2_memos_anon_insert on public.s2_memos for insert to anon
  with check (status = '새 메모' and reply is null and handled_at is null);

-- 도배 막기 — 한 학교에 10분 안 20건이 넘으면 거절. 키가 HTML 에 있어 누구나 넣을 수 있다.
create or replace function public.s2_memos_flood()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.s2_memos
      where univ = new.univ and created_at > now() - interval '10 minutes') >= 20 then
    raise exception '메모가 너무 많다 — 10분 뒤에 다시 써 주세요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.s2_memos_flood() from public, anon, authenticated;

drop trigger if exists s2_memos_flood on public.s2_memos;
create trigger s2_memos_flood before insert on public.s2_memos
  for each row execute function public.s2_memos_flood();

commit;
