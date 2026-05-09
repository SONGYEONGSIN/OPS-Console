import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OPERATORS, type Operator } from "./operators";

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
};

export async function getCurrentOperator(): Promise<CurrentOperator | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const operator = OPERATORS.find((op) => op.email === user.email) ?? null;
  return {
    email: user.email,
    operator,
    displayName: operator?.name ?? user.email.split("@")[0],
    role: operator?.role ?? "관리자",
    team: operator?.team ?? null,
  };
}
