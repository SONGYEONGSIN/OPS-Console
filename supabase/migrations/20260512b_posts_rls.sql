-- posts 테이블 RLS + GRANT
-- 정책: 모두 read / notice = admin only insert·update·delete / feedback = admin or 본인 author
-- 기존 is_admin() plpgsql helper 재사용 (operators 마이그레이션 20260510b).

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.posts enable row level security;

------------------------------------------------------------
-- 2) select — 모두 read 가능
------------------------------------------------------------

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert — notice는 admin only / feedback은 admin or 본인 author
------------------------------------------------------------

drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert"
  on public.posts for insert
  to authenticated
  with check (
    case domain
      when 'notice' then public.is_admin()
      else (
        public.is_admin()
        or author_email = (auth.jwt() ->> 'email')
      )
    end
  );

------------------------------------------------------------
-- 4) update — 동일 분기
------------------------------------------------------------

drop policy if exists "posts_update" on public.posts;
create policy "posts_update"
  on public.posts for update
  to authenticated
  using (
    case domain
      when 'notice' then public.is_admin()
      else (
        public.is_admin()
        or author_email = (auth.jwt() ->> 'email')
      )
    end
  )
  with check (
    case domain
      when 'notice' then public.is_admin()
      else (
        public.is_admin()
        or author_email = (auth.jwt() ->> 'email')
      )
    end
  );

------------------------------------------------------------
-- 5) delete — 동일 분기
------------------------------------------------------------

drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete"
  on public.posts for delete
  to authenticated
  using (
    case domain
      when 'notice' then public.is_admin()
      else (
        public.is_admin()
        or author_email = (auth.jwt() ->> 'email')
      )
    end
  );

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'posts';
-- 기대: posts_select_all / posts_insert / posts_update / posts_delete (4개)
