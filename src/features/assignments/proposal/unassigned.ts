import { workKey } from "../workload";
import { EXCLUDED_WORK_KINDS } from "./objective";

/**
 * 미배정 감지 — 평일 잡이 **무엇을 판정 요청으로 만드는가**(설계 §6.4).
 *
 * **미배정과 '연결 안 됨' 은 다르다**(F2). 주소가 안 붙었어도 이름이 남아 있으면
 * 사람은 배정을 했고 주소만 못 이은 것이다. 그걸 판정으로 보내면 에이전트가 이미
 * 담당자가 있는 칸에 남을 앉히고, 관리자는 왜 담당자가 둘인지를 설명할 수 없다.
 * 고칠 것은 주소이므로 건수만 보고한다.
 *
 * **단위는 (대학 × 업무종류)다**(rev 4). 하위유형 하나가 비었다고 요청하면
 * 에이전트가 나머지 하위유형 담당자와 다른 사람을 앉혀 그 대학이 갈린다 — C4 가
 * 막으려던 분할을 우리가 만드는 셈이다.
 *
 * **'원장에 없는 서비스'(새 대학)는 여기서 보지 않는다.** PR5 실측에서 서비스
 * 원천과 원장의 이름이 안 맞는 키가 48곳(원서접수 32·대학원 16)이고 그 숫자는 매일
 * 같다 — 평일 보고에 올리면 늘 켜져 있는 경고등이 되어 진짜 변화를 덮는다. 대학명
 * 갈림은 대조 버튼(`reconcileAssignments`)이 드러내는 자리가 이미 있고, 별칭을
 * 추측해 잇지 않는 것이 설계 F1 이다.
 */

/** 배정은 운영 칸이다 — 개발자는 `operators` 밖이라 배정 대상이 될 수 없다(PR4b). */
const OPERATION_ROLE = "운영";

/**
 * 한 번에 적재할 요청 수 상한.
 *
 * 이관이 실패해 원장이 통째로 비면 300건이 쌓이고, 폴러가 5분에 1건씩 가져가므로
 * 큐가 며칠 잠긴다 — 그 사이 관리자가 손으로 지목한 단건도 뒤에 선다. 넘친 것은
 * 다음 실행이 이어 간다(적재된 것은 잠금에 걸려 두 번 세지 않는다).
 */
export const SWEEP_MAX_ENQUEUE = 10;

export type UnassignedLedgerCell = {
  university_name: string;
  work_kind: string;
  role: string;
  assignee_email: string | null;
  /** 이름 스냅샷. 이메일 매칭이 실패해도 이것만은 남는다(F2). */
  assignee_name: string;
};

export type UnassignedKey = { university_name: string; work_kind: string };

/** (대학|업무종류) → 그 키의 운영 칸들. 제외 업무종류는 아예 담지 않는다. */
function operationCellsByKey(
  ledger: readonly UnassignedLedgerCell[],
): Map<string, UnassignedLedgerCell[]> {
  const byKey = new Map<string, UnassignedLedgerCell[]>();
  for (const c of ledger) {
    if (c.role !== OPERATION_ROLE) continue;
    if (EXCLUDED_WORK_KINDS.has(c.work_kind)) continue;
    const k = workKey(c);
    byKey.set(k, [...(byKey.get(k) ?? []), c]);
  }
  return byKey;
}

const hasAssignee = (c: UnassignedLedgerCell) =>
  c.assignee_email !== null || c.assignee_name.trim() !== "";

/**
 * 담당자가 **하나도 없는** (대학 × 업무종류). 이름조차 없는 칸만 미배정이다.
 *
 * 정렬하는 이유는 상한이 있어서다 — 순서가 흔들리면 실행마다 다른 것이 잘려
 * 어떤 대학은 영영 요청이 안 만들어진다.
 */
export function findUnassignedKeys(
  ledger: readonly UnassignedLedgerCell[],
): UnassignedKey[] {
  const out: UnassignedKey[] = [];
  for (const cells of operationCellsByKey(ledger).values()) {
    if (cells.some(hasAssignee)) continue;
    out.push({
      university_name: cells[0].university_name,
      work_kind: cells[0].work_kind,
    });
  }
  return out.sort(
    (a, b) =>
      a.university_name.localeCompare(b.university_name, "ko") ||
      a.work_kind.localeCompare(b.work_kind, "ko"),
  );
}

/**
 * 이름은 있는데 주소가 없는 (대학 × 업무종류) 수 — 보고의 '닿지 않은 것' 절(§8).
 *
 * 요청을 만들지 않는 대신 이 숫자로 드러낸다. 0 이 아니면 사람이 명부에서 이름을
 * 맞춰 줘야 하고, 그때까지 그 칸은 배정이 있는 것으로 취급된다.
 */
export function unlinkedCount(ledger: readonly UnassignedLedgerCell[]): number {
  let n = 0;
  for (const cells of operationCellsByKey(ledger).values()) {
    const linked = cells.some((c) => c.assignee_email !== null);
    const named = cells.some((c) => c.assignee_name.trim() !== "");
    if (!linked && named) n += 1;
  }
  return n;
}
