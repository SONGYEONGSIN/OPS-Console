"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { getGraphToken } from "@/lib/microsoft/auth";
import { columnLetter } from "./queries";

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

  for (const u of updates) {
    const col = columnLetter(u.colIdx);
    const address = `${col}${sheetRowNumber}:${col}${sheetRowNumber}`;
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encoded}')/range(address='${address}')`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ values: [[u.value]] }),
    });
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
