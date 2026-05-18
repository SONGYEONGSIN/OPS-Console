-- ai_tips RLS + GRANT — ai_work 패턴 mirror
-- SELECT 전원 read / INSERT·UPDATE·DELETE = admin OR 본인 author

begin;

alter table public.ai_tips enable row level security;

drop policy if exists "ai_tips_select_all" on public.ai_tips;
create policy "ai_tips_select_all"
  on public.ai_tips for select
  to authenticated
  using (true);

drop policy if exists "ai_tips_insert" on public.ai_tips;
create policy "ai_tips_insert"
  on public.ai_tips for insert
  to authenticated
  with check (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "ai_tips_update" on public.ai_tips;
create policy "ai_tips_update"
  on public.ai_tips for update
  to authenticated
  using (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "ai_tips_delete" on public.ai_tips;
create policy "ai_tips_delete"
  on public.ai_tips for delete
  to authenticated
  using (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  );

grant select, insert, update, delete on public.ai_tips to authenticated;
grant all on public.ai_tips to service_role;

commit;

notify pgrst, 'reload schema';
