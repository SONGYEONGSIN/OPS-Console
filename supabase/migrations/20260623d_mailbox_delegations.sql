-- 메일함 위임 (Phase 2) — A(owner)가 B(grantee)에게 열람+발송 위임
begin;

create table if not exists public.mailbox_delegations (
  id            uuid primary key default gen_random_uuid(),
  owner_email   text not null,
  grantee_email text not null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  unique (owner_email, grantee_email)
);

create index if not exists mailbox_delegations_grantee_active_idx
  on public.mailbox_delegations (grantee_email)
  where revoked_at is null;

commit;
