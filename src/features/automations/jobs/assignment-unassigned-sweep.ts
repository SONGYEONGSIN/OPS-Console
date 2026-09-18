import "server-only";
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import { listLedgerRows } from "@/features/assignments/ledger-queries";
import {
  findUnassignedKeys,
  unlinkedCount,
  SWEEP_MAX_ENQUEUE,
} from "@/features/assignments/proposal/unassigned";
import {
  AUTOMATION_REQUESTER,
  enqueueProposeRequest,
} from "@/features/assignments/propose-requests/enqueue";
import type { AutomationRunResult } from "../types";

/**
 * 미배정 감지(설계 §6.4) — 평일마다 원장을 훑어 **주인 없는 칸**을 판정으로 보낸다.
 *
 * **학년도를 시계에서 도출하지 않는다.** rollover 는 새 학년도가 시작된 것을 알아야
 * 해서 `currentAcademicYear()` 를 쓰지만, 이쪽은 **화면에 떠 있는 그 원장**을 훑는
 * 것이고 대학배정 화면은 `BAEJUNG_CURRENT_YEAR` 를 본다. 두 값이 갈리면 3월에 한 해를
 * 건너뛰어, 화면엔 `미배정` 배지가 떠 있는데 잡은 빈 원장을 보고 '미배정 없음' 을
 * 보고한다 — 가장 나쁜 종류의 조용한 무동작이다.
 *
 * 연간 생성과 **잡을 가르는 이유**는 실패의 뜻이 달라서다. 연간 생성 실패는 '새
 * 학년도를 시작할 수 없다' 이고 이쪽은 '새 서비스가 무주공산이다' 다.
 */
export async function runAssignmentUnassignedSweep(): Promise<AutomationRunResult> {
  let ledger;
  try {
    ledger = await listLedgerRows(BAEJUNG_CURRENT_YEAR);
  } catch (e) {
    // 조회 실패를 0건으로 읽으면 '미배정 없음' 이 매일 보고된다.
    return {
      ok: false,
      message: e instanceof Error ? e.message : "원장 조회 실패",
    };
  }

  const keys = findUnassignedKeys(ledger);
  const unlinked = unlinkedCount(ledger);
  const tail = unlinked > 0 ? ` · 닿지 않은 것 ${unlinked}곳` : "";

  if (keys.length === 0) {
    return { ok: true, message: `미배정 없음${tail}` };
  }

  /**
   * **막힌 요청은 상한을 깎지 않는다.** 이미 대기 중인 것이 상한을 먹으면 매 실행이
   * 같은 앞자리에서 막혀 뒤쪽 대학은 영영 요청이 안 만들어진다. 새로 적재된 것만 센다.
   *
   * 하나가 실패해도 멈추지 않는다 — 한 대학의 문제로 나머지 전부를 못 보게 두지 않고,
   * 실패는 결과에 남겨 보고에 드러낸다.
   */
  let queued = 0;
  const failures: string[] = [];
  for (const k of keys) {
    if (queued >= SWEEP_MAX_ENQUEUE) break;
    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, {
      academicYear: BAEJUNG_CURRENT_YEAR,
      kind: "single",
      universityName: k.university_name,
      workKind: k.work_kind,
    });
    if (!r.ok) failures.push(`${k.university_name} ${k.work_kind}`);
    else if (!r.skipped) queued += 1;
  }

  const rest = keys.length - queued;
  const head =
    `미배정 ${keys.length}곳 · 요청 ${queued}건 적재` +
    (rest > 0 ? ` (남은 ${rest}곳은 다음 실행에서)` : "");
  const failed = failures.length > 0 ? ` · 적재 실패 ${failures.length}건` : "";

  return {
    ok: failures.length === 0,
    message: `${head}${failed}${tail}`,
  };
}
