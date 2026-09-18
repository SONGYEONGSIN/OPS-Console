import {
  buildWorkload,
  UNSET_GROUP,
  type WorkloadGroup,
  type WorkloadOperator,
  type WorkloadSpan,
  type WorkloadWindows,
} from "../workload";
import { TENURE_GROUP_LABELS, type TenureGroup } from "../tenure";
import { ledgerHolders, type GateLedgerCell } from "./gate";
import { ASSIGNMENT_LIMITS } from "./objective";

/**
 * 판정 입력표와 지시문 — **서버가 조립한다**(§6.3).
 *
 * 어시스턴트 선례다: 프롬프트가 서버에 있어야 표현을 고칠 때 회사 PC 를 안 만진다.
 * 판정 자체는 회사 PC 의 Agent SDK 가 하고, 이 모듈은 **모델 호출을 하지 않는다.**
 *
 * 제약은 두 자리에서 지켜진다(§6.1) — 입력에서 빼거나 출력에서 거부한다.
 * **C5·C6·C7 은 여기서 빠진다**: 후보에 단순 건만 담고 상담앱을 아예 넣지 않는다.
 * 제안할 수 없는 것은 거부할 필요도 없다.
 */

/** 옮길 수 있는 한 칸. `parse-response` 가 환각을 가르는 기준이 이 목록이다. */
export type MoveCandidate = {
  university_name: string;
  work_kind: string;
  assignee_email: string;
};

/** 자동 배정 대상이 아닌 업무종류(결정 6). */
const EXCLUDED_WORK_KINDS = new Set(["상담앱"]);

const groupLabel = (group: string) =>
  TENURE_GROUP_LABELS[group as TenureGroup] ?? group;

const round1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/**
 * 후보 — **단순 건만**(C5). 한 사람이 그 업무종류의 모든 하위유형을 혼자 맡고,
 * 그 대학이 여러 운영자로 갈려 있지도 않은 건이다.
 *
 * 순서는 원장 순서를 따른다 — 가나다순으로 다시 세우면 같은 대학의 업무가 흩어져
 * 사람이 응답을 검산하기 어려워진다.
 */
export function moveCandidates(
  ledger: readonly GateLedgerCell[],
): MoveCandidate[] {
  const { byKey, byUniv } = ledgerHolders(ledger);
  const out: MoveCandidate[] = [];
  const seen = new Set<string>();

  for (const [key, holders] of byKey) {
    if (holders.size !== 1) continue;
    const [holder] = [...holders];
    if (!holder) continue;
    const [university_name, work_kind] = key.split("|");
    if (EXCLUDED_WORK_KINDS.has(work_kind)) continue;
    // 갈린 44곳은 건드리지 않는다(C4) — 후보에 안 담으면 거부할 일도 없다.
    if ((byUniv.get(university_name)?.size ?? 0) > 1) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ university_name, work_kind, assignee_email: holder });
  }
  return out;
}

const operatorTable = (groups: readonly WorkloadGroup[]) =>
  groups
    .filter((g) => g.group !== UNSET_GROUP && g.target)
    .map((g) => {
      const head = `## ${groupLabel(g.group)} — 목표 ${round1(g.target!.universities)}곳 / 밀도 ${round1(g.target!.density)}`;
      const rows = g.rows.map(
        (r) =>
          `- ${r.email} — ${r.universities}곳 / ${r.services}건 / 밀도 ${round1(r.density)} / 목표 대비 ${Math.round((r.deviation ?? 0) * 100)}%`,
      );
      return [head, ...rows].join("\n");
    })
    .join("\n\n");

const candidateTable = (candidates: readonly MoveCandidate[]) =>
  candidates
    .map((c) => `- ${c.university_name} | ${c.work_kind} | ${c.assignee_email}`)
    .join("\n");

/**
 * 입력표 넷 + 지시문. 상한은 `ASSIGNMENT_LIMITS` 하나에서 온다 — 두 벌이 되면
 * 모델에게는 3곳이라 말하고 게이트는 5곳을 받아 주게 된다(§6.1 끝).
 *
 * 문자열만 만든다. **환경 변수를 읽지 않는다** — 이 프롬프트는 회사 PC 의
 * 에이전트로 나가므로, 키가 한 번 섞이면 그 경로 전체가 유출 경로가 된다.
 */
export function buildProposalPrompt(input: {
  operators: readonly WorkloadOperator[];
  ledger: readonly GateLedgerCell[];
  serviceCounts: Readonly<Record<string, number>>;
  spans: readonly WorkloadSpan[];
  windows: WorkloadWindows;
  /**
   * 단건 판정 — 이 한 칸만 묻는다(§6.3). **후보를 좁히지 않으면** 관리자가 서비스
   * 하나를 지목했는데 모델이 학년도 전체를 재배분해 온다. 지목한 칸이 단순 건이
   * 아니면 후보가 비고, 그건 사람이 정할 일이라는 뜻이다(C4).
   */
  only?: { university_name: string; work_kind: string };
}): { prompt: string; candidates: MoveCandidate[] } {
  const groups = buildWorkload({ ...input, cells: input.ledger });
  const all = moveCandidates(input.ledger);
  const only = input.only;
  const candidates = only
    ? all.filter(
        (c) =>
          c.university_name === only.university_name &&
          c.work_kind === only.work_kind,
      )
    : all;

  const task = only
    ? `**${only.university_name}의 ${only.work_kind} 이 한 칸**을 누가 맡아야 할지 고르는 일을 맡았습니다. 아래 후보 목록에 그 칸만 있고, 그 칸 말고는 아무것도 옮기지 마십시오.`
    : "운영부의 대학 배정을 **연차 그룹 안에서만** 고르게 다듬는 일을 맡았습니다.";

  const prompt = `${task}

# 무엇을 보는가

부하 지표는 셋이지만 둘만 독립입니다 — 건수 = 대학 수 × 밀도라 건수는 결과값입니다.
목표는 (대학 수, 밀도) 둘이고, 편차는 두 축의 상대 편차 합입니다.

**그룹 사이의 차이는 건드리지 마십시오.** 연차가 높을수록 대학 수가 많고 밀도가 낮은 것은
의도된 것입니다. 같은 그룹 안에서 한 명이 17곳, 다른 한 명이 29곳일 때만 조정 대상입니다.

# 운영자별 실측

${operatorTable(groups)}

# 옮길 수 있는 후보 (대학 | 업무종류 | 지금 담당자)

${candidateTable(candidates)}

# 지켜야 할 것

- 같은 연차 그룹 안에서만 옮깁니다.
- 위 후보 목록에 있는 칸만 옮깁니다. 목록에 없는 대학은 제안하지 마십시오.
- 한 사람이 ${ASSIGNMENT_LIMITS.perOperator}곳을 넘게 관여하지 않습니다(주는 쪽·받는 쪽 모두 셉니다).
- 배치 전체가 ${ASSIGNMENT_LIMITS.perBatch}곳을 넘지 않습니다.
- 이동은 그룹 편차 합을 **줄여야** 합니다. 과부하자에서 저부하자 방향으로만 옮깁니다.
- 줄마다 근거 문장을 답니다. 근거가 없으면 사람이 승인할 수 없습니다.
- 옮길 것이 없으면 빈 목록이 옳은 답입니다. 억지로 채우지 마십시오.

# 응답 형식

다른 말 없이 JSON 만 돌려주십시오.

{"moves":[{"university_name":"...","work_kind":"...","prev_assignee":"...","next_assignee":"...","reason":"..."}]}
`;

  return { prompt, candidates };
}
