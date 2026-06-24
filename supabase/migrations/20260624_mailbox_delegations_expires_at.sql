-- 메일함 위임 만료 — expires_at(ISO timestamptz). null = 무기한.
-- 만료되면 접근 판정(canAccessMailbox/드롭다운/패널)에서 지연 만료로 자동 제외한다.
-- 수동 해제(revoked_at)는 그대로 유지. cron 불필요.
begin;

alter table public.mailbox_delegations
  add column if not exists expires_at timestamptz;

-- 활성+미만료 조회용 부분 인덱스 (grantee 기준, 자주 쓰는 접근 판정 경로).
create index if not exists mailbox_delegations_active_expiry_idx
  on public.mailbox_delegations (grantee_email, expires_at)
  where revoked_at is null;

commit;
