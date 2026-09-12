import { closingServicesRowSchema } from "./schemas";
import type { ClosingIngestRow, ClosingRow } from "./schemas";

/**
 * 인제스트 배치 한 행과 DB 에 이미 있는 같은 service_id 행을 비교한다.
 *
 * 왜 필요한가: 인제스트는 오래 `ignoreDuplicates: true` 라 **한 번 적재된 행은
 * 값이 바뀌어도 영영 그대로**였다(국립군산대 1035061 의 solo 가 몇 달째 false).
 * 이제 갱신하되 바뀐 칸만 `closing_service_changes` 에 남긴다 — 그러려면
 * "무엇이 무엇으로 바뀌었나"를 먼저 알아야 하고, 그 계산이 이 파일이다.
 *
 * 라우트에 인라인으로 두지 않는 이유는 아래 두 함정이 조용하기 때문이다.
 * 둘 다 `__tests__/diff-row.test.ts` 가 고정한다.
 *
 * 1. **시각 표기** — 스크래퍼는 `to_kst_iso` 로 `+09:00` 을 보내고 DB 는
 *    timestamptz 를 `+00:00` 으로 돌려준다. 문자열로 비교하면 매 실행마다
 *    전 행이 '변경됨' 으로 잡혀 이력이 쓰레기가 된다. epoch 로 비교한다.
 * 2. **undefined vs null** — payload 는 optional 필드를 아예 빼고 오고 DB 는
 *    null 을 준다. 둘은 같은 값이다.
 */

/**
 * 비교 대상 필드. `service_id` 는 두 행을 짝지은 **매칭 키**라 항상 같으므로
 * 빠진다(엑셀 14 컬럼 = service_id + 여기 13개).
 */
export const CLOSING_DIFF_FIELDS = [
  "university_name",
  "region",
  "service_name",
  "university_type",
  "category",
  "admission_type",
  "operator_name",
  "developer_name",
  "write_start_at",
  "write_end_at",
  "pay_start_at",
  "pay_end_at",
  "solo",
] as const;

export type ClosingDiffField = (typeof CLOSING_DIFF_FIELDS)[number];

/** DB 에서 읽어오는 비교용 부분 행. */
export type ClosingComparable = Pick<ClosingRow, ClosingDiffField>;

/**
 * 비교용 행의 DB read 검증 — service_id(매칭 키) + 비교 13 필드.
 *
 * 키가 하나라도 빠지면 zod 가 조용히 걷어내고 `undefined` → null 로 정규화돼
 * "값이 null 로 바뀌었다"는 거짓 변경이 전 행에 찍힌다. 그래서 이 mask 가
 * `CLOSING_DIFF_FIELDS` 와 일치하는지를 테스트가 고정한다.
 */
export const closingComparableSchema = closingServicesRowSchema.pick({
  service_id: true,
  university_name: true,
  region: true,
  service_name: true,
  university_type: true,
  category: true,
  admission_type: true,
  operator_name: true,
  developer_name: true,
  write_start_at: true,
  write_end_at: true,
  pay_start_at: true,
  pay_end_at: true,
  solo: true,
});

export type ClosingDiffChange = {
  field: ClosingDiffField;
  prev_value: string | null;
  next_value: string | null;
};

/** timestamptz 컬럼 — 문자열이 아니라 순간으로 비교한다. */
const TIMESTAMP_FIELDS = new Set<ClosingDiffField>([
  "write_start_at",
  "write_end_at",
  "pay_start_at",
  "pay_end_at",
]);

/**
 * 비교와 이력 저장에 함께 쓰는 표준형.
 *
 * 시각은 UTC ISO 로 맞춘다 — 이력 두 칸이 `+00:00` 과 `+09:00` 으로 섞이면
 * 사람이 읽고도 바뀐 건지 표기만 다른 건지 분간을 못 한다.
 * 파싱 안 되는 값은 손대지 않는다(원문 그대로 비교 — 조용히 같다고 하느니 드러낸다).
 */
function normalize(
  field: ClosingDiffField,
  value: string | boolean | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (!TIMESTAMP_FIELDS.has(field)) return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

export function diffClosingRow(
  prev: ClosingComparable,
  next: ClosingIngestRow,
): ClosingDiffChange[] {
  const changes: ClosingDiffChange[] = [];
  for (const field of CLOSING_DIFF_FIELDS) {
    const prevValue = normalize(field, prev[field]);
    const nextValue = normalize(field, next[field]);
    if (prevValue === nextValue) continue;
    changes.push({ field, prev_value: prevValue, next_value: nextValue });
  }
  return changes;
}
