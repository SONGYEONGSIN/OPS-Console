/**
 * 정산완료·계산서발행의 공통 규칙.
 *
 * 두 단계가 한 표(`service_billing`)에 한 줄로 담기고 권한 규칙도 같아서, 판정을
 * 여기 한 곳에 둔다. 전형료정산과 계산서발행이 각자 판정하면 언젠가 갈라진다.
 */

/** 한 서비스의 정산·발행 상태. 둘 다 null 이면 아직 아무것도 안 한 것이다. */
export type BillingState = {
  settledAt: string | null;
  issuedAt: string | null;
};

/**
 * 이 서비스의 정산완료·발행을 만질 수 있는가.
 *
 * 규칙은 오픈안내(`open-notices/actions.ts`)와 같다 — **본인 담당이거나 admin**.
 * 돈이 얽힌 기록이라 남의 담당 건을 오해로 닫는 일을 막는다.
 *
 * 담당자가 비어 있는 서비스는 admin 만 다룬다. 아무나 열어두면 주인 없는 건이
 * 조용히 닫히고, 그게 정산에서 가장 찾기 어려운 오류다.
 */
export function canEditBilling(input: {
  /** `closing_services.operator_name` — **폼이 아니라 DB 에서 읽은 값이어야 한다.** */
  operatorName: string | null;
  /** `operators.name` */
  myName: string | null;
  /** null 이면 운영자 조회가 안 된 것이다 — 모르는 권한은 막는다. */
  permission: string | null;
}): boolean {
  if (!input.permission) return false;
  // 읽기 전용 권한은 admin 이 아닌 한 어떤 경우에도 못 쓴다.
  if (input.permission === "viewer") return false;
  if (input.permission === "admin") return true;
  if (!input.myName || !input.operatorName) return false;
  return input.operatorName === input.myName;
}

/** 정산이 끝났는가. 시각이 있으면 끝난 것이다. */
export function isSettled(state: BillingState | undefined | null): boolean {
  return Boolean(state?.settledAt);
}

/**
 * 서비스 목록에 정산·발행 상태를 붙인다.
 *
 * 기록이 없으면 둘 다 null 이고 그게 "아직 안 했다"는 뜻이다 — 없는 행을
 * 만들어 두지 않는다.
 */
export function mergeBilling<T extends { service_id: number }>(
  rows: readonly T[],
  byServiceId: Record<number, BillingState>,
): (T & BillingState)[] {
  return rows.map((r) => {
    const state = byServiceId[r.service_id];
    return {
      ...r,
      settledAt: state?.settledAt ?? null,
      issuedAt: state?.issuedAt ?? null,
    };
  });
}
