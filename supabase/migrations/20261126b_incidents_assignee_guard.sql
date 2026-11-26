-- 사고(incidents) 담당자 칸 잠금 — authenticated 는 assignee_* 를 못 바꾼다.
-- 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md §5
-- 담당자를 본인으로 바꾸면 삭제 정책(admin OR assignee)을 통과해 남의 사고와 그 경위서(cascade)를 지울 수 있었다.
-- 앱은 담당자를 바꾸지 않는다(incidentUpdateSchema 에 assignee_* 없음). 나머지 칸의 공용 편집은 그대로.
-- service_role(서버)·postgres(SQL Editor)는 막지 않는다. security definer 로 바꾸지 말 것 — current_user 가 소유자가 된다.

begin;

create or replace function public.incidents_guard_assignee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.assignee_email is distinct from old.assignee_email
       or new.assignee_name is distinct from old.assignee_name) then
    raise exception '사고 담당자는 바꿀 수 없습니다' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.incidents_guard_assignee() from public, anon, authenticated;

drop trigger if exists incidents_guard_assignee on public.incidents;
create trigger incidents_guard_assignee
before update of assignee_email, assignee_name on public.incidents
for each row execute function public.incidents_guard_assignee();

commit;
