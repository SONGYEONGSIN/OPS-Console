-- 견적서 (자료 보관 > 견적서) Phase 1 — 목록 관리
begin;

create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  customer    text not null,
  quote_date  date not null,
  valid_until date,
  amount      bigint,
  owner_email text,
  status      text not null default 'draft',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists quotes_quote_date_idx
  on public.quotes (quote_date desc);

commit;
