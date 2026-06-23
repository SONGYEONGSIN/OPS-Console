import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailboxDelegationSchema, type MailboxDelegation } from "./schemas";

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
    .is("revoked_at", null);
  if (error) {
    console.error("[listMailboxesDelegatedTo] error:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.owner_email as string);
}
