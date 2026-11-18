-- 주간보고 개발 구분에 'deployed'(리얼배포 끝, 접수 시작 전)를 더한다.
-- 이 구분은 개발·테스트 어느 묶음에도 들지 않는다 — 오픈 주가 오면 접수기간으로 차주 오픈 예정에 든다.
-- 20261116_ops_weekly.sql 의 check 는 이름 없는 칸 check 라 이름을 짐작하지 않는다.
-- 짐작이 틀리면 옛 check 가 살아남아 'deployed' 를 계속 거부하므로, stage 를 보는 check 를 모두 찾아 지운 뒤 다시 건다.
-- 다시 돌려도 결과가 같다(지우고 다시 건다). 한 블록이라 중간에 실패하면 통째로 되돌아간다.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.ops_weekly_dev_status'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stage%'
  loop
    execute format('alter table public.ops_weekly_dev_status drop constraint %I', r.conname);
  end loop;

  alter table public.ops_weekly_dev_status
    add constraint ops_weekly_dev_status_stage_check
    check (stage in ('dev','test','deployed'));
end $$;
