import "server-only";

import { getGraphToken } from "@/lib/microsoft/auth";

/**
 * 미수채권 화면에서 원본 엑셀로 바로 가기 위한 SharePoint webUrl 조회.
 *
 * - 미수채권대장: SHAREPOINT_RECEIVABLES_DRIVE_ID + SHAREPOINT_RECEIVABLES_ITEM_ID
 * - 수수료입금내역: 같은 드라이브 + SHAREPOINT_DEPOSIT_ITEM_ID
 *   (입금 매칭 잡이 읽는 시트와 같은 파일 — deposit-queries.ts도 drive_id를 재사용한다)
 *
 * 조회 실패는 null로 돌려준다. 버튼을 아예 안 그리는 편이 깨진 링크를 누르게 하는 것보다 낫고,
 * 링크 하나 때문에 미수채권 목록 전체가 못 뜨는 일은 없어야 한다.
 */
export type ReceivablesWorkbookLinks = {
  /** 미수채권대장 — 전원 노출 */
  ledgerUrl: string | null;
  /** 수수료입금내역 — admin 전용 (노출 판단은 호출부) */
  depositUrl: string | null;
};

async function fetchWebUrl(
  token: string,
  driveId: string,
  itemId: string,
): Promise<string | null> {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}?$select=webUrl`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(
        `[receivables] webUrl 조회 실패 (item=${itemId}): ${res.status}`,
      );
      return null;
    }
    const json = (await res.json()) as { webUrl?: string };
    return json.webUrl ?? null;
  } catch (e) {
    console.error(`[receivables] webUrl 조회 예외 (item=${itemId}):`, e);
    return null;
  }
}

export async function getReceivablesWorkbookLinks(): Promise<ReceivablesWorkbookLinks> {
  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const ledgerItemId = process.env.SHAREPOINT_RECEIVABLES_ITEM_ID;
  const depositItemId = process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
  if (!driveId) {
    console.error("[receivables] SHAREPOINT_RECEIVABLES_DRIVE_ID 미설정");
    return { ledgerUrl: null, depositUrl: null };
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[receivables] Graph 토큰 획득 실패:", e);
    return { ledgerUrl: null, depositUrl: null };
  }

  // 한쪽이 실패해도 다른 쪽 버튼은 살린다.
  const [ledgerUrl, depositUrl] = await Promise.all([
    ledgerItemId ? fetchWebUrl(token, driveId, ledgerItemId) : null,
    depositItemId ? fetchWebUrl(token, driveId, depositItemId) : null,
  ]);
  return { ledgerUrl, depositUrl };
}
