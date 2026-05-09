-- 운영부 조직구성 테이블 + RLS + Seed (17명)
--
-- Supabase Dashboard SQL Editor에서 한 번 실행:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql
--
-- 또는 supabase CLI: supabase db push

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create extension if not exists "uuid-ossp";

create table if not exists public.operators (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null unique,
  name        text not null,
  team        text not null check (team in ('운영1팀','운영2팀')),
  role        text not null check (role in ('부장','팀장','TL','매니저')),
  emp_no      text not null,
  hired_at    date not null,
  birth_date  date not null,
  gender      text not null check (gender in ('남','여')),
  division    text not null default '어플라이사업본부',
  department  text not null default '운영부',
  status      text not null default 'active'
              check (status in ('active','approved','review','urgent')),
  leader      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at auto
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists operators_set_updated_at on public.operators;
create trigger operators_set_updated_at
before update on public.operators
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) RLS — 인증 사용자만 read/write
------------------------------------------------------------

alter table public.operators enable row level security;

drop policy if exists "operators_select" on public.operators;
create policy "operators_select"
  on public.operators for select
  to authenticated
  using (true);

drop policy if exists "operators_insert" on public.operators;
create policy "operators_insert"
  on public.operators for insert
  to authenticated
  with check (true);

drop policy if exists "operators_update" on public.operators;
create policy "operators_update"
  on public.operators for update
  to authenticated
  using (true)
  with check (true);

------------------------------------------------------------
-- 3) Seed — OPERATORS 17명
------------------------------------------------------------

insert into public.operators (email, name, team, role, emp_no, hired_at, birth_date, gender) values
  ('alcure23@jinhakapply.com',   '허승철', '운영1팀', '부장',   '200806010', '2008-06-01', '1982-10-06', '남'),
  ('hhj@jinhakapply.com',        '한효진', '운영1팀', 'TL',     '20220701',  '2007-05-30', '1981-06-14', '남'),
  ('bluewhich87@jinhakapply.com','김슬기', '운영1팀', '매니저', '20150703',  '2011-02-07', '1987-06-09', '여'),
  ('kjy0926@jinhakapply.com',    '김지영', '운영1팀', '매니저', '20160702',  '2016-07-27', '1989-09-26', '여'),
  ('annooy@jinhakapply.com',     '정윤나', '운영1팀', '매니저', '20190801',  '2019-08-01', '1995-09-16', '여'),
  ('sept98@jinhakapply.com',     '김유민', '운영1팀', '매니저', '20230506',  '2023-05-18', '1998-09-07', '여'),
  ('jkee@jinhakapply.com',       '기자의', '운영1팀', '매니저', '20240501',  '2024-05-02', '1999-03-13', '여'),
  ('jje@jinhakapply.com',        '전지은', '운영1팀', '매니저', '20250701',  '2025-07-14', '2001-03-12', '여'),
  ('ys1114@jinhakapply.com',     '송영신', '운영2팀', '팀장',   '20131004',  '2013-10-14', '1987-12-01', '남'),
  ('pkm0313@jinhakapply.com',    '박시현', '운영2팀', '매니저', '201008010', '2010-08-05', '1984-03-13', '여'),
  ('wnlgp@jinhakapply.com',      '윤지혜', '운영2팀', 'TL',     '200505310', '2005-05-30', '1984-10-22', '여'),
  ('haelee0201@jinhakapply.com', '이해영', '운영2팀', '매니저', '20170602',  '2017-06-12', '1993-02-01', '여'),
  ('rsjw2014@jinhakapply.com',   '임종우', '운영2팀', '매니저', '20220101',  '2022-01-10', '1995-08-20', '남'),
  ('hogj1213@jinhakapply.com',   '전혜인', '운영2팀', '매니저', '20230505',  '2023-05-18', '1998-12-13', '여'),
  ('ksh@jinhakapply.com',        '김승현', '운영2팀', '매니저', 'P20250505', '2025-10-27', '2000-11-20', '여'),
  ('kjh@jinhakapply.com',        '김지현', '운영2팀', '매니저', '20240502',  '2024-05-02', '1997-12-10', '여'),
  ('kjn@jinhakapply.com',        '김지나', '운영2팀', '매니저', '20240702',  '2024-07-08', '2000-02-02', '여')
on conflict (email) do nothing;

------------------------------------------------------------
-- 4) 인덱스
------------------------------------------------------------

create index if not exists operators_team_idx on public.operators (team);
create index if not exists operators_status_idx on public.operators (status);
