import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailboxDelegationSchema, type MailboxDelegation } from "./schemas";

/**
 * 종료일(YYYY-MM-DD, KST 기준) → 그날 23:59:59.999 KST의 ISO(UTC). (순수)
 * null/빈 값은 무기한(만료 없음)으로 본다. 서버 TZ와 무관하게 +09:00 고정 계산.
 */
export function expiryFromDate(ymd: string | null): string | null {
  if (!ymd) return null;
  return new Date(`${ymd}T23:59:59.999+09:00`).toISOString();
}

// 활성 위임 PostgREST .or 필터 — 미만료(만료 없음 또는 만료시각이 미래).
function activeExpiryFilter(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}

/** 순수 — viewer가 owner 메일함을 볼 수 있는가(본인 또는 활성 위임). */
export function isOwnerOrActiveDelegate(
  viewer: string,
  owner: string,
  active: { owner_email: string; grantee_email: string }[],
): boolean {
  if (viewer === owner) return true;
  return active.some(
    (d) => d.owner_email === owner && d.grantee_email === viewer,
  );
}

/** viewer가 owner 메일함 접근 가능 여부 — 본인이거나 활성 위임 존재. */
export async function canAccessMailbox(
  viewer: string,
  owner: string,
): Promise<boolean> {
  if (viewer === owner) return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("mailbox_delegations")
    .select("id")
    .eq("owner_email", owner)
    .eq("grantee_email", viewer)
    .is("revoked_at", null)
    .or(activeExpiryFilter())
    .maybeSingle();
  return !!data;
}

/** 내가 준 활성 위임 목록(owner=me). 위임 관리 패널용. */
export async function listMyDelegations(
  ownerEmail: string,
): Promise<MailboxDelegation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_delegations")
    .select("*")
    .eq("owner_email", ownerEmail)
    .is("revoked_at", null)
    .or(activeExpiryFilter())
    .order("granted_at", { ascending: false });
  if (error) {
    console.error("[listMyDelegations] error:", error.message);
    return [];
  }
  const rows: MailboxDelegation[] = [];
  for (const r of data ?? []) {
    const p = mailboxDelegationSchema.safeParse(r);
    if (p.success) rows.push(p.data);
  }
  return rows;
}

/** 나에게 위임한 owner 이메일 목록(활성). [내 메일함 ▼] 드롭다운용. */
export async function listMailboxesDelegatedTo(
  granteeEmail: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_delegations")
    .select("owner_email")
    .eq("grantee_email", granteeEmail)
    .is("revoked_at", null)
    .or(activeExpiryFilter());
  if (error) {
    console.error("[listMailboxesDelegatedTo] error:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.owner_email as string);
}
