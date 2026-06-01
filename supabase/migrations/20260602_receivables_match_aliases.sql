-- 입금 매칭 거래처 alias — admin이 불일치(금액 일치·이름 불일치)를 승인할 때 학습.
-- 입금 거래내용(공백제거) → 타깃 정규화 거래처. 잡이 매 실행 시 로드해 normalizeName에 병합.
-- 기존 하드코딩 SPECIAL_MAP(normalize.ts)을 런타임 admin 관리로 확장.
-- RLS: select admin/member, insert/update admin (server action은 service_role bypass).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.receivables_match_aliases (
  id                   uuid primary key default uuid_generate_v4(),
  alias_key            text not null unique,            -- 입금 거래내용 (공백제거)
  alias_value          text not null,                   -- 타깃 정규화 거래처 (예: '서강대')
  source_misu_customer text,                            -- 승인 당시 미수 거래처 (스냅샷)
  source_dep_content   text,                            -- 승인 당시 입금 거래내용 (스냅샷)
  created_by           text,                            -- 승인한 운영자 이메일
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists receivables_match_aliases_set_updated_at on public.receivables_match_aliases;
create trigger receivables_match_aliases_set_updated_at
before update on public.receivables_match_aliases
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists receivables_match_aliases_created_at_desc_idx
  on public.receivables_match_aliases (created_at desc);

------------------------------------------------------------
-- 3) RLS — select admin/member, insert/update admin
------------------------------------------------------------

alter table public.receivables_match_aliases enable row level security;

drop policy if exists "receivables_match_aliases_select" on public.receivables_match_aliases;
create policy "receivables_match_aliases_select"
  on public.receivables_match_aliases for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

drop policy if exists "receivables_match_aliases_insert_admin" on public.receivables_match_aliases;
create policy "receivables_match_aliases_insert_admin"
  on public.receivables_match_aliases for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "receivables_match_aliases_update_admin" on public.receivables_match_aliases;
create policy "receivables_match_aliases_update_admin"
  on public.receivables_match_aliases for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.receivables_match_aliases to authenticated;
grant all on public.receivables_match_aliases to service_role;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.receivables_match_aliases
-- select policyname, cmd from pg_policies where tablename = 'receivables_match_aliases';
-- 기대: 8 컬럼 + 3 정책 (select / insert_admin / update_admin)
