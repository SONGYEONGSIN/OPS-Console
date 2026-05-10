import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OPERATORS, type Operator } from "./operators";
import {
  operatorPermissionSchema,
  type OperatorPermission,
} from "@/features/operators/schemas";

/**
 * 현재 로그인 사용자의 OPERATORS 매칭 결과 + 표시용 메타데이터.
 *
 * - 매칭되는 OPERATORS 멤버: operator/displayName/role/team 모두 OPERATORS 값
 * - 매칭 안 되는 이메일 (dev/admin 등): operator=null, displayName=email username,
 *   role="관리자", team=null
 * - 비로그인: 함수가 null 반환
 */
export type CurrentOperator = {
  email: string;
  operator: Operator | null;
  displayName: string;
  role: string;
  team: Operator["team"] | null;
  permission: OperatorPermission | null;
  /** 사이드바 메뉴 접근 권한 (slug 배열). admin은 빈 배열로 두고 bypass. */
  allowedMenus: string[];
};

export async function getCurrentOperator(): Promise<CurrentOperator | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const operator = OPERATORS.find((op) => op.email === user.email) ?? null;

  // DB에서 permission + allowed_menus 룩업 — JWT custom claim 미사용(즉시 회수 반영).
  // 매칭 안 되는 이메일(dev/admin)은 row 없음 → null/빈 배열.
  const { data: dbRow } = await supabase
    .from("operators")
    .select("permission, allowed_menus")
    .eq("email", user.email)
    .maybeSingle();
  const parsed = operatorPermissionSchema.safeParse(dbRow?.permission);
  const permission: OperatorPermission | null = parsed.success
    ? parsed.data
    : null;
  const rawMenus = dbRow?.allowed_menus;
  const allowedMenus: string[] = Array.isArray(rawMenus)
    ? rawMenus.filter((s): s is string => typeof s === "string")
    : [];

  return {
    email: user.email,
    operator,
    displayName: operator?.name ?? user.email.split("@")[0],
    role: operator?.role ?? "관리자",
    team: operator?.team ?? null,
    permission,
    allowedMenus,
  };
}
