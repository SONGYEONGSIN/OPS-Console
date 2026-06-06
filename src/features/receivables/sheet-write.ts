import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import {
  getWorkbookSession,
  refreshWorkbookSession,
} from "@/lib/microsoft/workbook-session";
import { columnLetter } from "./queries";

const RETRY_STATUSES = new Set([408, 503, 504]);

function patchOnce(
  url: string,
  token: string,
  sessionId: string,
  value: string,
): Promise<Response> {
  return fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "workbook-session-id": sessionId,
    },
    body: JSON.stringify({ values: [[value]] }),
  });
}

/**
 * 미수채권 시트의 단일 컬럼·다중 행에 동일 값 PATCH.
 * 권한 검사 없음 — 호출자(수동: admin 가드 / 자동화: cron 게이트)가 책임진다.
 * 토큰·세션 1회 발급 후 행별 PATCH(504 등 시 세션 재발급 1회 retry).
 */
export async function patchSingleColumn(args: {
  worksheetName: string;
  colIdx: number;
  rowNumbers: number[];
  value: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_RECEIVABLES_ITEM_ID;
  if (!driveId || !itemId) {
    return { ok: false, error: "SHAREPOINT_RECEIVABLES_* 환경변수 누락" };
  }
  if (args.rowNumbers.length === 0) return { ok: true };

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    return {
      ok: false,
      error: `토큰 발급 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  let sessionId: string;
  try {
    sessionId = await getWorkbookSession(driveId, itemId);
  } catch (e) {
    return {
      ok: false,
      error: `워크북 세션 발급 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const encoded = encodeURIComponent(args.worksheetName);
  const col = columnLetter(args.colIdx);
  for (const rn of args.rowNumbers) {
    const address = `${col}${rn}:${col}${rn}`;
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encoded}')/range(address='${address}')`;
    let res = await patchOnce(url, token, sessionId, args.value);
    if (RETRY_STATUSES.has(res.status)) {
      try {
        sessionId = await refreshWorkbookSession(driveId, itemId);
      } catch {
        // 세션 재발급 실패는 무시 — 다음 호출에서 동일 에러 처리
      }
      res = await patchOnce(url, token, sessionId, args.value);
    }
    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Graph PATCH ${address} ${res.status}: ${errText.slice(0, 200)}`,
      };
    }
  }
  return { ok: true };
}
