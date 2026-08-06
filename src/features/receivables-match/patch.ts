import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import {
  getWorkbookSession,
  refreshWorkbookSession,
} from "@/lib/microsoft/workbook-session";
import type { MatchPair } from "./types";

export type PatchResult = {
  ok: boolean;
  dryRun: boolean;
  /** K열 race 감지 — 재read 시 이미 "입금완료"여서 PATCH skip */
  skipped?: boolean;
  errorMessage?: string;
};

const RETRY_STATUSES = new Set([408, 503, 504]);

/**
 * 워크북 1개에 대한 Graph 호출기 — 세션 헤더 부착 + 504류 시 세션 재발급 1회 재시도.
 *
 * 세션 없이 연속 PATCH를 던지면 워크북 활성화에 걸려 504가 나고, 그 실패가 조용히
 * 유실되면 J열만 빠진 반쪽 기록이 남는다(2026-08-04). `receivables/sheet-write.ts`가
 * 쓰는 것과 동일한 패턴이다.
 */
function createWorkbookCaller(
  driveId: string,
  itemId: string,
  initialSession: string,
  token: string,
): (url: string, init?: RequestInit) => Promise<Response> {
  let session = initialSession;
  return async (url, init = {}) => {
    const send = () =>
      fetch(url, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`,
          "workbook-session-id": session,
        },
      });
    let res = await send();
    if (RETRY_STATUSES.has(res.status)) {
      try {
        session = await refreshWorkbookSession(driveId, itemId);
      } catch {
        // 세션 재발급 실패는 무시 — 재시도 응답에서 동일 에러로 드러난다
      }
      res = await send();
    }
    return res;
  };
}

function rangeUrl(
  driveId: string,
  itemId: string,
  sheetName: string,
  range: string,
): string {
  const enc = encodeURIComponent(sheetName);
  return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${enc}')/range(address='${range}')`;
}

/**
 * 단일 미수 행의 K열을 GET — race 방어용. PATCH 직전 호출하여 "미처리" 확인.
 */
async function readMisuNoteCell(
  call: (url: string, init?: RequestInit) => Promise<Response>,
  url: string,
): Promise<string> {
  const res = await call(`${url}?$select=values`);
  if (!res.ok) return "";
  const data = (await res.json()) as { values?: unknown[][] };
  return String(data.values?.[0]?.[0] ?? "").trim();
}

async function patchCell(
  call: (url: string, init?: RequestInit) => Promise<Response>,
  url: string,
  range: string,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await call(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      error: `Graph PATCH ${range} ${res.status}: ${errText.slice(0, 200)}`,
    };
  }
  return { ok: true };
}

/**
 * 매칭 쌍 → 미수 시트 J열(입금일자)=depositDate + K열(적요)="입금완료" +
 * 입금 시트 K열(미결제표시)="처리완료" PATCH.
 *
 * - dryRun=true: 호출 없이 ok:true, dryRun:true 반환
 * - PATCH 전 K열 재read → "입금완료"면 skip (PR-3 전 GAS doGet과의 race 방어)
 * - N:M 케이스면 misuRows / depRows 여러 개 모두 PATCH
 * - **행마다 J를 먼저 쓰고 K를 나중에 쓴다.** K가 완료 표시이자 race 가드의 판정 기준이라,
 *   K를 먼저 쓰면 J 실패 시 그 행이 '처리완료'로 굳어 재실행에서도 영구 제외된다.
 * - 어느 한 셀이라도 실패하면 즉시 ok:false + errorMessage — 잡 이력에 드러나야 한다.
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

  let misuCall: (url: string, init?: RequestInit) => Promise<Response>;
  let depCall: (url: string, init?: RequestInit) => Promise<Response>;
  try {
    misuCall = createWorkbookCaller(
      driveId,
      misuItem,
      await getWorkbookSession(driveId, misuItem),
      token,
    );
    depCall = createWorkbookCaller(
      driveId,
      depItem,
      await getWorkbookSession(driveId, depItem),
      token,
    );
  } catch (e) {
    return {
      ok: false,
      dryRun: false,
      errorMessage: `워크북 세션 발급 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // ① race 방어 — 첫 미수 행 K열 재read
  const first = pair.misuRows[0];
  if (first) {
    const current = await readMisuNoteCell(
      misuCall,
      rangeUrl(driveId, misuItem, misuSheetName, `K${first}:K${first}`),
    );
    if (current === "입금완료") {
      return { ok: false, dryRun: false, skipped: true };
    }
  }

  // ② 미수 J(입금일자) → K(입금완료) 순서로 PATCH (각 misuRows)
  for (const row of pair.misuRows) {
    for (const cell of [
      { range: `J${row}:J${row}`, value: pair.depositDate },
      { range: `K${row}:K${row}`, value: "입금완료" },
    ]) {
      const res = await patchCell(
        misuCall,
        rangeUrl(driveId, misuItem, misuSheetName, cell.range),
        cell.range,
        cell.value,
      );
      if (!res.ok) {
        return { ok: false, dryRun: false, errorMessage: res.error };
      }
    }
  }

  // ③ 입금 K PATCH (각 depRows)
  for (const row of pair.depRows) {
    const range = `K${row}:K${row}`;
    const res = await patchCell(
      depCall,
      rangeUrl(driveId, depItem, depositSheetName, range),
      range,
      "처리완료",
    );
    if (!res.ok) {
      return { ok: false, dryRun: false, errorMessage: res.error };
    }
  }

  return { ok: true, dryRun: false };
}
