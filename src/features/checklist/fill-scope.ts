// 공개(토큰) 쓰기의 보안 핵심 — 순수 함수로 분리해 단위 테스트한다.
// fill-actions("use server")가 DB 조회 후 이 판정을 거쳐야만 반영한다.

export type FillTokenRow = {
  round_id: string;
  department: string | null;
  kind: string;
  enabled: boolean;
};

export type ScopeDenyReason =
  | "not-found"
  | "disabled"
  | "not-dept-fill"
  | "no-department"
  | "wrong-round"
  | "wrong-department";

export type ScopeResult = { ok: true } | { ok: false; reason: ScopeDenyReason };

/** 이 토큰이 '부서 작성(dept-fill)' 쓰기 권한을 갖는가. */
export function assertDeptFillToken(token: FillTokenRow | null): ScopeResult {
  if (!token) return { ok: false, reason: "not-found" };
  if (!token.enabled) return { ok: false, reason: "disabled" };
  if (token.kind !== "dept-fill") return { ok: false, reason: "not-dept-fill" };
  if (!token.department) return { ok: false, reason: "no-department" };
  return { ok: true };
}

/** 대상 항목이 토큰의 (회차, 부서) 범위에 속하는가. 다른 부서/회차 쓰기 차단. */
export function assertItemInScope(
  item: { round_id: string; department: string },
  token: { round_id: string; department: string | null },
): ScopeResult {
  if (item.round_id !== token.round_id)
    return { ok: false, reason: "wrong-round" };
  if (item.department !== token.department)
    return { ok: false, reason: "wrong-department" };
  return { ok: true };
}

/** 거부 사유 → 작성자에게 보여줄 한국어 메시지. */
export function denyMessage(reason: ScopeDenyReason): string {
  switch (reason) {
    case "not-found":
      return "유효하지 않은 링크입니다.";
    case "disabled":
      return "비활성화된 링크입니다.";
    case "not-dept-fill":
      return "작성 권한이 없는 링크입니다.";
    case "no-department":
      return "부서 정보가 없는 링크입니다.";
    case "wrong-round":
    case "wrong-department":
      return "이 링크로는 수정할 수 없는 항목입니다.";
  }
}
