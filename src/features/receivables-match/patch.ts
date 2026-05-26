import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import type { MatchPair } from "./types";

export type PatchResult = {
  ok: boolean;
  dryRun: boolean;
  /** K열 race 감지 — 재read 시 이미 "입금완료"여서 PATCH skip */
  skipped?: boolean;
  errorMessage?: string;
};

/**
 * 단일 미수 행의 K열을 GET — race 방어용. PATCH 직전 호출하여 "미처리" 확인.
 */
async function readMisuNoteCell(
  driveId: string,
  itemId: string,
  sheetName: string,
  rowNumber: number,
  token: string,
): Promise<string> {
  const enc = encodeURIComponent(sheetName);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${enc}')/range(address='K${rowNumber}:K${rowNumber}')?$select=values`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { values?: unknown[][] };
  return String(data.values?.[0]?.[0] ?? "").trim();
}

async function patchCell(
  driveId: string,
  itemId: string,
  sheetName: string,
  range: string,
  value: string,
  token: string,
): Promise<void> {
  const enc = encodeURIComponent(sheetName);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${enc}')/range(address='${range}')`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
}

/**
 * 매칭 쌍 → 미수 시트 K열(적요)="입금완료" + J열(입금예정일)=depositDate +
 * 입금 시트 K열(미결제표시)="처리완료" PATCH.
 *
 * - dryRun=true: 호출 없이 ok:true, dryRun:true 반환
 * - PATCH 전 K열 재read → "입금완료"면 skip (PR-3 전 GAS doGet과의 race 방어)
 * - N:M 케이스면 misuRows / depRows 여러 개 모두 PATCH
 *
 * 환경변수:
 * - `SHAREPOINT_RECEIVABLES_DRIVE_ID` (drive 공통)
 * - `SHAREPOINT_RECEIVABLES_ITEM_ID` (미수 시트)
 * - `SHAREPOINT_DEPOSIT_ITEM_ID` (입금 시트)
 */
export async function patchMatchResult(
  pair: MatchPair,
  misuSheetName: string,
  depositSheetName: string,
  options: { dryRun: boolean },
): Promise<PatchResult> {
  if (options.dryRun) {
    return { ok: true, dryRun: true };
  }

  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const misuItem = process.env.SHAREPOINT_RECEIVABLES_ITEM_ID;
  const depItem = process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
  if (!driveId || !misuItem || !depItem) {
    return {
      ok: false,
      dryRun: false,
      errorMessage:
        "SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_RECEIVABLES_ITEM_ID / SHAREPOINT_DEPOSIT_ITEM_ID 누락",
    };
  }

  const token = await getGraphToken();

  // ① race 방어 — 첫 미수 행 K열 재read
  const first = pair.misuRows[0];
  if (first) {
    const current = await readMisuNoteCell(
      driveId,
      misuItem,
      misuSheetName,
      first,
      token,
    );
    if (current === "입금완료") {
      return { ok: false, dryRun: false, skipped: true };
    }
  }

  // ② 미수 K + J PATCH (각 misuRows)
  for (const row of pair.misuRows) {
    await patchCell(driveId, misuItem, misuSheetName, `K${row}:K${row}`, "입금완료", token);
    await patchCell(driveId, misuItem, misuSheetName, `J${row}:J${row}`, pair.depositDate, token);
  }

  // ③ 입금 K PATCH (각 depRows)
  for (const row of pair.depRows) {
    await patchCell(driveId, depItem, depositSheetName, `K${row}:K${row}`, "처리완료", token);
  }

  return { ok: true, dryRun: false };
}
