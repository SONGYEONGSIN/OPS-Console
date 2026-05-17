"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator, type CurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import {
  operatorCreateSchema,
  operatorUpdateSchema,
  ownProfileUpdateSchema,
  type OperatorRow,
} from "./schemas";
import { getDefaultMemberMenus } from "@/app/dashboard/_data/sidebar-helpers";

export type OperatorActionResult =
  | { ok: true; row: OperatorRow }
  | { ok: false; error: string };

const PERMISSION_ERROR = "권한 없음 — admin만 가능합니다.";
const SELF_DEMOTE_ERROR = "본인 권한 강등 불가";

/**
 * server action 진입 가드 — admin 외에는 즉시 거부.
 * RLS가 fallback 방어선이지만 명시적 에러 메시지를 사용자에게 노출하기 위해 server 레벨에서도 차단.
 */
async function ensureAdmin(): Promise<
  { ok: true; me: CurrentOperator } | { ok: false; error: string }
> {
  const me = await getCurrentOperator();
  if (!me || !canEditOperators(me.permission)) {
    return { ok: false, error: PERMISSION_ERROR };
  }
  return { ok: true, me };
}

export async function createOperator(
  input: unknown,
): Promise<OperatorActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard;

  const parsed = operatorCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  // member 신규 등록 시 allowed_menus 미제공이면 default 정책 적용
  // (admin은 bypass / viewer는 명시적 비어 있음)
  const payload =
    parsed.data.permission === "member" &&
    (!parsed.data.allowed_menus || parsed.data.allowed_menus.length === 0)
      ? { ...parsed.data, allowed_menus: getDefaultMemberMenus() }
      : parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true, row: data as OperatorRow };
}

/**
 * 삭제된 operator를 active로 복구. deleted_reason / deleted_at 초기화.
 */
export async function restoreOperator(
  id: string,
): Promise<OperatorActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .update({ status: "active", deleted_reason: null, deleted_at: null })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/team-deleted");
  return { ok: true, row: data as OperatorRow };
}

export async function updateOperator(
  id: string,
  input: unknown,
): Promise<OperatorActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard;

  const parsed = operatorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();

  // 본인 강등 차단 — admin이 자신의 permission을 admin 외로 변경 시도 시 거부
  if (parsed.data.permission && parsed.data.permission !== "admin") {
    const { data: target } = await supabase
      .from("operators")
      .select("email")
      .eq("id", id)
      .maybeSingle();
    if (target && target.email === guard.me.email) {
      return { ok: false, error: SELF_DEMOTE_ERROR };
    }
  }

  const { data, error } = await supabase
    .from("operators")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true, row: data as OperatorRow };
}

/**
 * 본인 프로필 update — name만 변경 가능. operators RLS는 admin only이므로
 * admin client로 RLS 우회하되, server action에서 본인 email만 강제 + 화이트리스트(name)로 권한 컬럼 변경 차단.
 */
export async function updateOwnProfile(
  input: unknown,
): Promise<OperatorActionResult> {
  const parsed = ownProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me?.email) {
    return { ok: false, error: "로그인이 필요합니다." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("operators")
    .update({ name: parsed.data.name })
    .eq("email", me.email)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "프로필을 찾을 수 없습니다." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, row: data as OperatorRow };
}
