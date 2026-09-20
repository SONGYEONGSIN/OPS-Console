import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentAcademicYear } from "@/lib/datetime";
import { countLedgerRows } from "@/features/assignments/ledger-queries";
import { listOperators } from "@/features/operators/queries";
import { buildWorkload } from "@/features/assignments/workload";
import { workloadWindows } from "@/features/assignments/workload-sources";
import {
  hasAnnualBatch,
  latestAnnualBasis,
} from "@/features/assignments/proposal/queries";
import {
  groupMembership,
  renewalReminder,
} from "@/features/assignments/proposal/report";
import {
  AUTOMATION_REQUESTER,
  enqueueProposeRequest,
} from "@/features/assignments/propose-requests/enqueue";
import type { AutomationRunResult } from "../types";

/**
 * 학년도 배정 요청 적재(설계 §6.4) — **판정은 회사 PC 가 한다.** 이 잡은 큐에 한 줄을
 * 넣을 뿐이다.
 *
 * **매일 돈다.** 연 1회를 담을 `cadence` 값이 없어서인데(`monthly` 는 미실행 판정이
 * 매달 오탐하고 `manual` 은 아예 판정 대상에서 빠진다), 그래서 "이미 있는가" 의 판정이
 * 이 잡의 전부다. 나머지 364일은 `skipped: true` 라 실패 집계에 안 들어간다.
 *
 * PC 가 꺼져 있어도 요청 적재는 계속되므로, PC 중단이 '조용한 무동작' 이 아니라
 * **pending 적체**로 드러난다.
 */
export async function runAssignmentYearRollover(
  now: Date = new Date(),
): Promise<AutomationRunResult> {
  // 시계에서 도출한다 — 여기서만큼은 `BAEJUNG_CURRENT_YEAR` 를 쓰면 안 된다.
  // 그 상수는 시트 헤더에 박힌 값이라 3월이 와도 안 움직이고, 새 학년도가
  // 시작된 것을 이 잡이 영영 모른다.
  const academicYear = currentAcademicYear(now);

  try {
    if (await hasAnnualBatch(academicYear)) {
      return {
        ok: true,
        skipped: true,
        message: `${academicYear}학년도 제안 배치가 이미 있습니다`,
      };
    }

    /**
     * **원장이 비어 있으면 시작하지 않는다.** 빈 원장으로 판정하면 제안 0건짜리
     * 배치가 만들어지고, 그 순간 위의 `hasAnnualBatch` 가 참이 되어 **진짜 배정은
     * 영영 제안되지 않는다.** 총괄장 이관이 먼저다.
     */
    /**
     * **admin 클라이언트로 읽는다 — 잡에는 세션이 없다.**
     *
     * `assignments`·`operators` 의 select 정책이 둘 다 `to authenticated` 라, 세션
     * 클라이언트로는 `count=null` 에 **코드도 메시지도 빈 에러**가 온다(실측
     * 2026-09-18 라이브 — 이 잡이 그대로 500 으로 죽었다).
     */
    const ledgerRows = await countLedgerRows(academicYear, createAdminClient());
    if (ledgerRows === 0) {
      return {
        ok: true,
        skipped: true,
        message: `원장에 ${academicYear}학년도 배정이 아직 없습니다 — 총괄장 이관이 먼저입니다`,
      };
    }

    const result = await enqueueProposeRequest(AUTOMATION_REQUESTER, {
      academicYear,
      kind: "annual",
    });

    return {
      ok: result.ok,
      skipped: result.skipped,
      message: [result.message, await reminderOf(academicYear, now)]
        .filter(Boolean)
        .join(" "),
    };
  } catch (e) {
    // **'없다' 로 읽지 않는다.** 조회 실패를 없음으로 삼키면 매일 새 요청을 적재하고
    // 폴러가 매일 같은 판정을 돌린다.
    return {
      ok: false,
      message: e instanceof Error ? e.message : "학년도 배정 요청 적재 실패",
    };
  }
}

/**
 * 3월 갱신 상기(결정 5) — 지금 그룹 구성이 **직전 annual 배치와 같은가**.
 *
 * 구성만 필요하므로 건수·진행 구간은 빈 값으로 넘긴다. `buildWorkload` 를 거치는
 * 이유는 **묶는 규칙이 한 곳이어야 하기 때문**이다 — 배정 대상 거르기(`assignable`)와
 * 그룹 키(`tenure_group ?? 그룹 미설정`)를 여기서 다시 적으면 `basis.groups` 를 만든
 * 쪽과 갈리고, 그러면 사람이 안 바꿨는데 '바뀌었다' 가 되어 상기가 조용히 사라진다.
 *
 * 못 읽으면 빈 문자열이다 — 부속 정보 때문에 학년도 배정을 막지 않는다.
 */
async function reminderOf(academicYear: number, now: Date): Promise<string> {
  const { previousYear, previous } = await latestAnnualBasis(academicYear);
  if (previousYear === null) return "";

  const operators = await listOperators(createAdminClient());
  const groups = buildWorkload({
    operators: operators.filter((o) => o.status === "active"),
    cells: [],
    serviceCounts: {},
    spans: [],
    windows: workloadWindows(now),
  });
  return renewalReminder({
    previousYear,
    previous,
    current: groupMembership(groups),
  });
}
