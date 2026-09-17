"use server";

import { getCurrentOperator } from "@/features/auth/queries";
import { fetchAssignmentSheet, SHEET_NAMES } from "./queries";
import { parseBaejungList, parseSimpleSheet, parsePims } from "./parse";
import type { AssignmentRecord } from "./schemas";
import {
  toLedgerRows,
  reconcile,
  type ImportIssue,
  type ReconcileResult,
} from "./import";
import { listLedgerRows, type LedgerRow } from "./ledger-queries";

/**
 * 총괄장 시트 ↔ 배정 원장 **대조**. 읽기만 한다.
 *
 * 원래 여기 있던 이관(쓰기)은 PR4 에서 걷었다(설계 §14). 편집이 앱에서 일어나기
 * 시작하면 자연키 upsert 가 **시트에 있는 모든 칸을 시트 값으로 되돌리고**, 그
 * 덮어씀이 `assignment_changes` 에 정당한 변경으로 남아 되돌릴 수도 사고로 구분할
 * 수도 없게 된다. 게다가 쓰기 뒤에 견주면 방금 덮어쓴 원장과 시트를 비교하니
 * **대조가 0건으로 통과한다** — 대조는 양쪽이 같은 원천에서 나오면 눈이 먼다.
 *
 * **admin 클라이언트를 만들지 않는 것이 곧 쓸 수 없다는 증거다.** 원장에는 쓰기
 * 정책이 없고 `service_role` 에만 `grant all` 이 있어, 세션 클라이언트로는 문법이
 * 맞아도 0행이 바뀐다. 시트를 방치해도(열린 질문 3) 갈림은 여기서 드러난다.
 */
export type ReconcileAssignmentsResult =
  | { ok: false; error: string }
  | { ok: true; issues: ImportIssue[]; reconcile: ReconcileResult };

/** 하위유형 없는 시트(03·06)의 헤더 규칙. 07 상담앱만 대학명 칸이 다르다. */
const SIMPLE_HEADERS = { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ };

/**
 * 다섯 시트 → 레코드. 하나도 못 읽으면 `null` 이다.
 *
 * ⚠️ 같은 파서 설정이 `app/dashboard/assignments/page.tsx` 와
 * `features/announcement-services/sync-operators.ts` 에도 있다 — 세 번째 복사다.
 * 헤더가 바뀌면 세 곳을 고쳐야 하니 단일 소스로 빼는 것이 맞지만, 이 PR 범위를
 * 넘으므로 별도 PR 로 남긴다.
 */
async function readSheets(): Promise<AssignmentRecord[] | null> {
  const [baejung, grad, pims, sungjuk, sangdam] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.성적산출),
    fetchAssignmentSheet(SHEET_NAMES.상담앱),
  ]);
  if (!baejung && !grad && !pims && !sungjuk && !sangdam) return null;

  return [
    ...(baejung ? parseBaejungList(baejung) : []),
    ...(grad ? parseSimpleSheet(grad, "대학원", SIMPLE_HEADERS) : []),
    ...(pims ? parsePims(pims) : []),
    ...(sungjuk ? parseSimpleSheet(sungjuk, "성적산출", SIMPLE_HEADERS) : []),
    ...(sangdam
      ? parseSimpleSheet(sangdam, "상담앱", {
          uni: /학교명|대학명/,
          op: /^운영자$/,
          dev: /^개발자$/,
        })
      : []),
  ];
}

export async function reconcileAssignments(
  academicYear: number,
): Promise<ReconcileAssignmentsResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 실행할 수 있습니다" };
  }
  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2000 ||
    academicYear > 9999
  ) {
    // 학년도가 자연키에 있어, 이상한 값은 아무도 안 보는 섬과 대조하게 된다.
    return { ok: false, error: `학년도가 이상합니다: ${academicYear}` };
  }

  const records = await readSheets();
  if (!records) return { ok: false, error: "총괄장을 읽지 못했습니다" };

  const { rows: sheetRows, issues } = toLedgerRows(records, academicYear);
  if (sheetRows.length === 0) {
    // 0건 성공으로 끝내면 '시트와 원장이 같다' 로 읽힌다.
    return { ok: false, error: "총괄장에서 배정 칸을 찾지 못했습니다" };
  }

  // 조회 실패를 빈 배열로 삼키지 않는다 — 삼키면 시트 전량이 '원장에 없음' 으로
  // 나와, 사람은 멀쩡히 들어간 원장을 의심한다.
  let ledger: LedgerRow[];
  try {
    ledger = await listLedgerRows(academicYear);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return { ok: true, issues, reconcile: reconcile(sheetRows, ledger) };
}
