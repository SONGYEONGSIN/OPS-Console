// 공개(토큰) 쓰기의 보안 핵심 — 순수 함수로 분리해 단위 테스트한다.
// 통합 작성 링크(fill)는 해당 회차의 모든 부서 항목을 쓸 수 있다(부서 구분 없음).
// 타 회차 쓰기는 차단. fill-actions("use server")가 DB 조회 후 이 판정을 거쳐야만 반영한다.

export type FillTokenRow = {
  round_id: string;
  kind: string;
  enabled: boolean;
};

export type ScopeDenyReason =
  | "not-found"
  | "disabled"
  | "not-fill"
  | "wrong-round";

export type ScopeResult = { ok: true } | { ok: false; reason: ScopeDenyReason };

/** 이 토큰이 '작성(fill)' 쓰기 권한을 갖는가. */
export function assertWriteToken(token: FillTokenRow | null): ScopeResult {
  if (!token) return { ok: false, reason: "not-found" };
  if (!token.enabled) return { ok: false, reason: "disabled" };
  if (token.kind !== "fill") return { ok: false, reason: "not-fill" };
  return { ok: true };
}

/** 대상 항목이 토큰의 회차에 속하는가. 타 회차 쓰기 차단. */
export function assertItemInRound(
  item: { round_id: string },
  token: { round_id: string },
): ScopeResult {
  if (item.round_id !== token.round_id)
    return { ok: false, reason: "wrong-round" };
  return { ok: true };
}

/** 거부 사유 → 작성자에게 보여줄 한국어 메시지. */
export function denyMessage(reason: ScopeDenyReason): string {
  switch (reason) {
    case "not-found":
      return "유효하지 않은 링크입니다.";
    case "disabled":
      return "비활성화된 링크입니다.";
    case "not-fill":
      return "작성 권한이 없는 링크입니다.";
    case "wrong-round":
      return "이 링크로는 수정할 수 없는 항목입니다.";
  }
}
