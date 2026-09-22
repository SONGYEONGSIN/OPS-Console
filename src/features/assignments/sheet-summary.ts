import { SERVICE_KIND_SHEETS, type ServiceKind } from "./schemas";
import type { WorkloadCell, WorkloadOperator } from "./workload";

/**
 * 시트별 현황 — **"이 295곳이 어느 시트의 것이냐"** 에 답한다(사용자 요구 2026-09-22).
 *
 * 카드 하나로는 배정리스트 293곳과 성적산출 44곳이 한 덩어리로 보여, 어느 시트를
 * 손봐야 하는지 화면에서 읽을 수 없었다.
 *
 * **행의 합은 합계와 다르다.** 한 대학이 원서접수·PIMS·성적산출에 동시에 걸려 있어
 * (실측 2026-09-22: 행의 합 467곳 ↔ 중복 제거 295곳) 두 값은 원래 안 맞는다. 맞추려고
 * 대학을 한 시트에만 넣으면 그 대학의 다른 업무가 화면에서 사라지므로, 합계 줄이
 * '중복 제거' 라고 적는 쪽을 택했다.
 *
 * 순수 함수다 — 어느 표에서 읽는지는 쿼리의 일이고 여기는 이미 잘린 값을 받는다.
 */

/**
 * 표에 세우는 업무종류. **상담앱은 뺀다**(사용자 지시 2026-09-22).
 *
 * 뺀다는 것은 **행으로 안 세운다**는 뜻이고, 그 칸 25개가 사라지는 것이 아니다 —
 * 담당 대학 합계는 원장 전체의 중복 제거라 상담앱만 맡은 대학도 거기 들어 있다.
 * 집계에서까지 빼면 화면의 합계가 원장과 다른 값이 된다.
 */
export const SHEET_SUMMARY_KINDS = [
  "원서접수",
  "대학원",
  "PIMS",
  "성적산출",
] as const satisfies readonly ServiceKind[];

export type SheetSummaryRow = {
  /** 원장 `work_kind`. */
  kind: ServiceKind;
  /** 사람이 여는 것은 업무종류가 아니라 시트다 — `SERVICE_KIND_SHEETS` 가 정본이다. */
  sheet: string;
  /** 그 시트에서 맡은 대학(중복 제거). 시트끼리는 겹친다. */
  universities: number;
  /**
   * 그 업무종류의 **원천 총량**. 붙었는지와 무관하게 센다 — 합계 줄이
   * `서비스 물량` 과 같아야 하고, 안 붙은 몫은 `안 붙음` 카드가 따로 말한다.
   *
   * 원천이 그 업무를 **아예 안 들면 `null`** 이다. 성적산출 44곳은 마감에도
   * 발표에도 없어서, 0 으로 적으면 '일이 없다' 로 읽힌다.
   */
  services: number | null;
};

/**
 * `workKey` 가 만든 키에서 업무종류를 되읽는다.
 *
 * **뒤에서 자른다** — 대학 이름에 `|` 가 섞여도 업무종류는 마지막 조각이다.
 */
const kindOfKey = (key: string) => key.slice(key.lastIndexOf("|") + 1);

export function summarizeBySheet(input: {
  operators: readonly WorkloadOperator[];
  cells: readonly WorkloadCell[];
  serviceCounts: Readonly<Record<string, number>>;
}): SheetSummaryRow[] {
  /*
   * **표와 같은 기준으로 센다.** `buildWorkload` 가 배정 대상만 보는데 여기서 전원을
   * 세면, 같은 화면의 두 숫자가 서로 다른 사람 집합을 말한다.
   */
  const known = new Set(
    input.operators.filter((o) => o.assignable).map((o) => o.email),
  );

  const univsByKind = new Map<string, Set<string>>();
  for (const c of input.cells) {
    if (!c.assignee_email || !known.has(c.assignee_email)) continue;
    const univs = univsByKind.get(c.work_kind) ?? new Set<string>();
    univs.add(c.university_name);
    univsByKind.set(c.work_kind, univs);
  }

  const servicesByKind = new Map<string, number>();
  for (const [key, n] of Object.entries(input.serviceCounts)) {
    const kind = kindOfKey(key);
    servicesByKind.set(kind, (servicesByKind.get(kind) ?? 0) + n);
  }

  return SHEET_SUMMARY_KINDS.map((kind) => ({
    kind,
    sheet: SERVICE_KIND_SHEETS[kind],
    universities: univsByKind.get(kind)?.size ?? 0,
    services: servicesByKind.get(kind) ?? null,
  }));
}
