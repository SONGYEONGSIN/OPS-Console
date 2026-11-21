-- 요강이 장별 메모(s2_memos) 보강 — 최종 검토(2026-11-06)에서 나온 도배 막기 우회를 막는다.
-- 설계: jinhak-inspect docs/superpowers/specs/2026-11-06-yogang-memo-design.md
--
-- 1) anon 이 모든 칸을 넣을 수 있어 created_at 을 옛날로 넣으면 「10분 안 20건」 세기를 피했다 → 넣을 수 있는 칸을 좁힌다.
-- 2) 쓴 시각은 트리거가 늘 now() 로 — 혹시 다른 길로 들어와도 세기가 맞게.
-- 3) 학교 이름을 바꿔 가며 넣으면 학교당 한도를 피한다 → 전체 한도(10분 200건)도 둔다.

begin;

revoke insert on public.s2_memos from anon;
grant insert (univ, sheet, kind, body, author) on public.s2_memos to anon;

create or replace function public.s2_memos_flood()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at := now();
  if (select count(*) from public.s2_memos
      where univ = new.univ and created_at > now() - interval '10 minutes') >= 20 then
    raise exception '메모가 너무 많다 — 10분 뒤에 다시 써 주세요' using errcode = 'P0001';
  end if;
  if (select count(*) from public.s2_memos where created_at > now() - interval '10 minutes') >= 200 then
    raise exception '메모가 너무 많다 — 10분 뒤에 다시 써 주세요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.s2_memos_flood() from public, anon, authenticated;

commit;
