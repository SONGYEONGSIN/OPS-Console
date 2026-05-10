-- schedule_events 테이블 RLS + GRANT
-- 정책: 모두 read / insert·update·delete = admin OR 본인(assignee_email or created_by_email = JWT email)
-- 기존 is_admin() plpgsql helper 재사용 (operators 마이그레이션 20260510b).
--
-- 주의: 도메인 분기는 OR 조건으로 풀어쓴다 (CASE 문은 Supabase SQL Editor 파서와 충돌 — posts에서 학습).
-- 본인 검증: 작성자(created_by_email) 본인 또는 본인이 assignee로 지정된 경우 모두 허용.
--   admin OR created_by_email = JWT email OR assignee_email = JWT email

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.schedule_events enable row level security;

------------------------------------------------------------
-- 2) select — 모두 read 가능 (팀 공통 일정 공유)
------------------------------------------------------------

drop policy if exists "schedule_events_select_all" on public.schedule_events;
create policy "schedule_events_select_all"
  on public.schedule_events for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert — admin OR 본인이 created_by 또는 assignee
------------------------------------------------------------

drop policy if exists "schedule_events_insert" on public.schedule_events;
create policy "schedule_events_insert"
  on public.schedule_events for insert
  to authenticated
  with check (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
    or assignee_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 4) update — 동일 조건
------------------------------------------------------------

drop policy if exists "schedule_events_update" on public.schedule_events;
create policy "schedule_events_update"
  on public.schedule_events for update
  to authenticated
  using (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
    or assignee_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
    or assignee_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 5) delete — 동일 조건
------------------------------------------------------------

drop policy if exists "schedule_events_delete" on public.schedule_events;
create policy "schedule_events_delete"
  on public.schedule_events for delete
  to authenticated
  using (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
    or assignee_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.schedule_events to authenticated;
grant all on public.schedule_events to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'schedule_events';
-- 기대: schedule_events_select_all / _insert / _update / _delete (4개)
