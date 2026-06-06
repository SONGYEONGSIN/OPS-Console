import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import {
  getWorkbookSession,
  refreshWorkbookSession,
} from "@/lib/microsoft/workbook-session";
import { columnLetter } from "@/features/receivables/queries";

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
 * 발송 완료 행들의 '이메일오류' 컬럼을 'Y'로 PATCH (재발송 1차 idempotency).
 * receivables/sheet-write.ts patchSingleColumn 패턴 — SMILEEDI env + 단일 값 'Y' 고정.
 * 호출자(자동화 cron 게이트)가 권한 책임.
 */
export async function markEmailErrorY(args: {
  worksheetName: string;
  emailErrorColIdx: number;
  rowNumbers: number[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const driveId = process.env.SHAREPOINT_SMILEEDI_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_SMILEEDI_ITEM_ID;
  if (!driveId || !itemId) {
    return { ok: false, error: "SHAREPOINT_SMILEEDI_* 환경변수 누락" };
  }
  if (args.emailErrorColIdx < 0) {
    return { ok: false, error: "이메일오류 컬럼을 찾을 수 없음" };
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
  const col = columnLetter(args.emailErrorColIdx);
  for (const rn of args.rowNumbers) {
    const address = `${col}${rn}:${col}${rn}`;
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encoded}')/range(address='${address}')`;
    let res = await patchOnce(url, token, sessionId, "Y");
    if (RETRY_STATUSES.has(res.status)) {
      try {
        sessionId = await refreshWorkbookSession(driveId, itemId);
      } catch {
        // 세션 재발급 실패는 무시 — 동일 에러로 처리됨
      }
      res = await patchOnce(url, token, sessionId, "Y");
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
