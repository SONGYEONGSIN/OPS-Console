"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { getGraphToken } from "@/lib/microsoft/auth";
import {
  getWorkbookSession,
  refreshWorkbookSession,
} from "@/lib/microsoft/workbook-session";
import { columnLetter } from "./queries";

/** PATCH 1회 호출 — 504/408 등 timeout 시 호출자가 retry 결정 */
async function patchCellOnce(args: {
  url: string;
  token: string;
  sessionId: string;
  value: string;
}): Promise<Response> {
  return fetch(args.url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
      "workbook-session-id": args.sessionId,
    },
    body: JSON.stringify({ values: [[args.value]] }),
  });
}

const RETRY_STATUSES = new Set([408, 503, 504]);

export type ReceivablesActionResult =
  | { ok: true }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER =
  "권한 없음 — viewer는 미수채권 수정이 불가합니다.";
const ENV_ERROR =
  "SharePoint 환경변수 누락 (SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_RECEIVABLES_ITEM_ID).";

export type CellUpdate = {
  /** Excel 원본 컬럼 인덱스 (0-based, validIdx 적용 후) */
  colIdx: number;
  value: string;
};

/**
 * 다중 Excel 셀 PATCH (적요·입금예정일 등 한 row의 여러 셀 동시 update).
 * 각 셀은 개별 PATCH — Graph는 multi-range 합치기 미지원.
 *
 * @param worksheetName    워크시트 이름
 * @param sheetRowNumber   1-based row 번호
 * @param updates          { colIdx, value }[]
 */
export async function updateReceivablesCells(
  worksheetName: string,
  sheetRowNumber: number,
  updates: CellUpdate[],
): Promise<ReceivablesActionResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission === "viewer" || me.permission === null) {
    return { ok: false, error: PERMISSION_ERROR_VIEWER };
  }

  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_RECEIVABLES_ITEM_ID;
  if (!driveId || !itemId) return { ok: false, error: ENV_ERROR };

  if (updates.length === 0) return { ok: true };

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    return {
      ok: false,
      error: `토큰 발급 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const encoded = encodeURIComponent(worksheetName);
  let sessionId: string;
  try {
    sessionId = await getWorkbookSession(driveId, itemId);
  } catch (e) {
    return {
      ok: false,
      error: `워크북 세션 발급 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  for (const u of updates) {
    const col = columnLetter(u.colIdx);
    const address = `${col}${sheetRowNumber}:${col}${sheetRowNumber}`;
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encoded}')/range(address='${address}')`;

    let res = await patchCellOnce({ url, token, sessionId, value: u.value });

    // 504/408/503 발생 시 세션 재발급 후 1회 retry — workbook 활성화 대기 회피
    if (RETRY_STATUSES.has(res.status)) {
      try {
        sessionId = await refreshWorkbookSession(driveId, itemId);
      } catch {
        // 세션 재발급 실패는 무시 — 다음 patchCellOnce에서 동일 에러 캐치
      }
      res = await patchCellOnce({ url, token, sessionId, value: u.value });
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Graph PATCH ${address} ${res.status}: ${errText.slice(0, 200)}`,
      };
    }
  }

  revalidatePath("/dashboard/receivables");
  return { ok: true };
}
