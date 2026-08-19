import "server-only";
import { cache } from "react";
import { fetchAssignmentSheet, SHEET_NAMES } from "@/features/assignments/queries";
import type { AssigneeRow } from "./assignee-match";

/**
 * 총괄장에서 담당자 표를 읽는다.
 *
 * 열 위치는 실제 시트를 확인해 정했다(2026-08-19):
 * - `02. 배정리스트` — 3열 대학명, **13열 2027학년도 운영자/수시**
 *   (헤더가 2행 병합이라 데이터는 3행부터)
 * - `03. 대학원` — 1열 대학명, **7열 운영자** (헤더 1행)
 *
 * 열이 밀리면 엉뚱한 사람이 담당자로 들어간다. 시트가 바뀌면 여기가 먼저 깨지도록
 * 헤더를 확인하고, 안 맞으면 빈 배열을 돌려준다 — 틀린 값보다 빈칸이 낫다.
 */

const UNDER_NAME_COL = 3;
const UNDER_SUSI_COL = 13;
const UNDER_HEADER_ROWS = 2;

const GRAD_NAME_COL = 1;
const GRAD_OPERATOR_COL = 7;
const GRAD_HEADER_ROWS = 1;

export const loadAssigneeRows = cache(async function loadAssigneeRows(): Promise<{
  under: AssigneeRow[];
  grad: AssigneeRow[];
}> {
  const [u, g] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
  ]);

  const under: AssigneeRow[] = (u?.rowsText ?? [])
    .slice(UNDER_HEADER_ROWS)
    .filter((r) => r[UNDER_NAME_COL])
    .map((r) => ({
      university: r[UNDER_NAME_COL],
      operator: r[UNDER_SUSI_COL] ?? "",
    }));

  const grad: AssigneeRow[] = (g?.rowsText ?? [])
    .slice(GRAD_HEADER_ROWS)
    .filter((r) => r[GRAD_NAME_COL])
    .map((r) => ({
      university: r[GRAD_NAME_COL],
      operator: r[GRAD_OPERATOR_COL] ?? "",
    }));

  return { under, grad };
});
