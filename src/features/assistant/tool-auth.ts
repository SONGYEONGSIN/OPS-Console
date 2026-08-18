import { visibleDomains } from "./domain-menu";
import type { SourceDomain } from "./search";
import type { OperatorPermission } from "@/features/operators/schemas";

/**
 * 어시스턴트 도구가 공통으로 거는 요청자 검증.
 *
 * 7개 테이블의 RLS가 `for select to authenticated using (true)`라 행은 안 걸러진다
 * (2026-08-18 확인). 그래서 권한은 **사람 단위로** 여기서 건다 — 없는 사람, 비활성,
 * viewer는 답을 못 받는다. 두 라우트가 같은 검사를 복사하면 갈라지므로 한 곳에 둔다.
 */

export type ToolAuthResult =
  | { ok: true; allowed: Set<SourceDomain> }
  | { ok: false; status: 403; error: string };

type OperatorRow = { permission: string | null; status: string | null };

/** admin 클라이언트의 `.from("operators")…maybeSingle()` 결과만 받는다. */
export function authorizeToolRequest(
  operator: OperatorRow | null,
): ToolAuthResult {
  if (!operator) {
    return { ok: false, status: 403, error: "등록되지 않은 운영자입니다" };
  }
  if (operator.status !== "active") {
    return { ok: false, status: 403, error: "활성 상태가 아닌 운영자입니다" };
  }
  const allowed = new Set(
    visibleDomains((operator.permission ?? null) as OperatorPermission | null),
  );
  if (allowed.size === 0) {
    return {
      ok: false,
      status: 403,
      error: "이 권한으로는 조회할 수 없습니다",
    };
  }
  return { ok: true, allowed };
}
