import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import { listLedgerRows } from "@/features/assignments/ledger-queries";
import {
  findUnassignedKeys,
  unlinkedCount,
} from "@/features/assignments/proposal/unassigned";
import type { AutomationRunResult } from "../types";

/**
 * 미배정 감지 — 평일마다 원장을 훑어 **주인 없는 칸이 있는지 알린다.**
 *
 * **요청은 적재하지 않는다**(설계 2026-09-21 §8 · 사용자 2026-09-20). 연간 배정은
 * 3월에 끝났고 그 뒤는 모니터링이라, 새 서비스가 들어왔을 때 *누구에게 줄지* 는
 * 사람이 화면에서 정한다 — `업무배정 > 신규배정` 의 `[배정 요청]` 버튼이다.
 *
 * 자동 적재를 남겨 두면 제안 탭이 **아무도 요청하지 않은 단건 배치**로 차고,
 * `requested_by` 가 전부 `automation` 이라 누가 왜 만들었는지가 사라진다. 상한
 * (`SWEEP_MAX_ENQUEUE`)과 그 상한이 만든 '다음 실행이 이어 간다' 도 함께 걷혔다 —
 * 감지는 전건을 본다.
 *
 * **학년도를 시계에서 도출하지 않는다.** 이 잡은 **화면에 떠 있는 그 원장**을 훑는
 * 것이고 대학배정 화면은 `BAEJUNG_CURRENT_YEAR` 를 본다. 두 값이 갈리면 3월에 한 해를
 * 건너뛰어, 화면엔 `미배정` 배지가 떠 있는데 잡은 빈 원장을 보고 '미배정 없음' 을
 * 보고한다 — 가장 나쁜 종류의 조용한 무동작이다.
 */
export async function runAssignmentUnassignedSweep(): Promise<AutomationRunResult> {
  let ledger;
  try {
    // **admin 클라이언트로 읽는다 — 잡에는 세션이 없다.** `assignments` 의 select
    // 정책이 `to authenticated` 라, 세션 클라이언트로는 코드도 메시지도 빈 에러가
    // 온다(실측 2026-09-18 — rollover 가 같은 이유로 프로덕션에서 500 이 났다).
    ledger = await listLedgerRows(BAEJUNG_CURRENT_YEAR, createAdminClient());
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

  // 건수만 알리고 끝나면 '그래서 어디서 하나' 가 남는다. 갈 곳을 함께 적는다.
  return {
    ok: true,
    message: `미배정 ${keys.length}곳${tail} — 업무배정 > 신규배정에서 배정 요청을 만드세요`,
  };
}
