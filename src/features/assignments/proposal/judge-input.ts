import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { listLedgerRows } from "../ledger-queries";
import { loadWorkloadSources } from "../workload-queries";
import { workloadWindows } from "../workload-sources";
import { buildWorkload, type WorkloadGroup, type WorkloadOperator } from "../workload";
import { buildProposalPrompt, type MoveCandidate } from "./prompt";
import type { GateContext, GateLedgerCell } from "./gate";

/**
 * 판정 입력 조립 — **폴러 창구에는 세션이 없다**(CRON_SECRET 으로 지키는 자리라
 * 쿠키가 없다). 그래서 service_role 로 읽고, **화면과 같은 조회 함수**에 그
 * 클라이언트를 넘긴다. 여기서 조회를 한 벌 더 쓰면 화면과 판정이 다른 원장을 본다.
 *
 * GET(프롬프트 주기)과 POST(응답 검산)가 각각 한 번씩 부른다. 값을 재사용하지 않는
 * 이유는 **G2(경합)가 지금 원장을 봐야** 하기 때문이다 — 판정이 도는 사이 사람이
 * 손으로 고쳤을 수 있다(§5.4).
 */

export type JudgeInput = {
  prompt: string;
  /**
   * 프롬프트 앞 16자 해시. **원문은 남기지 않는다** — `basis` 는 화면에서 펼쳐
   * 보이는 값이고, 프롬프트 전문은 거기에 실을 것이 아니다. '무엇으로 물었나' 를
   * 견주는 데는 해시가 충분하다.
   */
  promptHash: string;
  /** `parse-response` 가 환각을 가르는 기준. 프롬프트에 실린 것과 같은 목록이다. */
  candidates: MoveCandidate[];
  /**
   * 판정에 쓴 배분현황. `basis` 에 그대로 얼려 담긴다(§5.4) — 프롬프트가 본 것과
   * 배치에 남는 것이 **같은 값이어야** 나중에 그 배치를 다시 설명할 수 있다.
   */
  groups: WorkloadGroup[];
  gateContext: GateContext;
};

/**
 * 명부 — **service_role 로 직접 읽고 실패하면 던진다.**
 *
 * `listOperators` 는 조회 실패에 빈 배열을 돌려준다(목록 화면에는 그게 맞다).
 * 판정 경로에서 빈 명부는 '배정 대상 0명' 이라 프롬프트가 빈 표로 나가고, 모델은
 * 옮길 것이 없다고 답한다 — 조회가 터졌는데 '정상 판정, 이동 0건' 으로 남는다.
 */
async function loadAssignableOperators(): Promise<WorkloadOperator[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("operators")
    .select(
      "email, name, tenure_group, assignable, status, hired_at, career_start_at",
    );
  if (error) {
    throw new Error(`[assignments] 판정용 명부 조회 실패: ${error.message}`);
  }

  const rows = (data ?? []) as {
    email: string;
    name: string;
    tenure_group: string | null;
    assignable: boolean;
    status: string;
    hired_at: string;
    career_start_at: string | null;
  }[];
  // 활성만 — 퇴사자가 0곳으로 끼면 그룹 평균이 아래로 끌려 남은 사람이 전부
  // 과부하로 보인다. `assignable` 은 `buildWorkload` 가 따로 거른다.
  const active = rows.filter((o) => o.status === "active");

  if (!active.some((o) => o.assignable)) {
    throw new Error(
      "[assignments] 배정 대상인 활성 운영자가 없습니다 — 판정할 표가 비어 있습니다",
    );
  }
  return active.map((o) => ({
    email: o.email,
    name: o.name,
    tenure_group: o.tenure_group,
    assignable: o.assignable,
    hired_at: o.hired_at,
    career_start_at: o.career_start_at,
  }));
}

export async function loadJudgeInput(
  academicYear: number,
  now: Date = new Date(),
  /** 단건 판정의 대상. 없으면 학년도 전체 재배분이다. */
  only?: { university_name: string; work_kind: string },
): Promise<JudgeInput> {
  const admin = createAdminClient();
  const [operators, ledger, sources] = await Promise.all([
    loadAssignableOperators(),
    listLedgerRows(academicYear, admin),
    loadWorkloadSources(now, admin),
  ]);

  const gateContext: GateContext = {
    operators,
    // `LedgerRow` 가 `GateLedgerCell` 을 구조적으로 만족한다 — 자연키 다섯 칸이 같다.
    ledger: ledger as GateLedgerCell[],
    serviceCounts: sources.serviceCounts,
    spans: sources.spans,
    windows: workloadWindows(now),
  };

  const { prompt, candidates } = buildProposalPrompt({ ...gateContext, only });

  return {
    prompt,
    promptHash: createHash("sha256").update(prompt).digest("hex").slice(0, 16),
    candidates,
    // 프롬프트가 쓴 것과 같은 입력으로 다시 센다 — 순수 함수라 같은 값이 나온다.
    groups: buildWorkload({ ...gateContext, cells: gateContext.ledger }),
    gateContext,
  };
}
