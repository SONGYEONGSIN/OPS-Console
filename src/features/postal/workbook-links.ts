import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";

/**
 * 원본 엑셀 바로가기 — 등기대장 · 전도금대장.
 *
 * 미수채권이 이미 같은 것을 하고 있고(`features/receivables/workbook-links.ts`)
 * 규칙도 같다: **조회에 실패한 항목은 null로 두어 버튼을 아예 안 그린다.**
 * 깨진 링크를 누르게 하는 것보다 없는 편이 낫다.
 *
 * 어느 것도 던지지 않는다 — 링크 하나 때문에 목록까지 죽으면 안 된다.
 */

export type PostalWorkbookLinks = {
  /** `2026년도 우편물 발송.xlsx` */
  ledgerUrl: string | null;
  /** `2026년도 전도금 비용.xlsx` */
  pettyCashUrl: string | null;
};

const NONE: PostalWorkbookLinks = { ledgerUrl: null, pettyCashUrl: null };

async function fetchWebUrl(
  token: string,
  driveId: string,
  itemId: string | undefined,
): Promise<string | null> {
  if (!itemId) return null;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}?$select=webUrl`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.error(
        `[postal] webUrl 조회 실패 (item=${itemId}): ${res.status}`,
      );
      return null;
    }
    const json = (await res.json()) as { webUrl?: string };
    return json.webUrl ?? null;
  } catch (e) {
    console.error(`[postal] webUrl 조회 예외 (item=${itemId}):`, e);
    return null;
  }
}

export async function getPostalWorkbookLinks(): Promise<PostalWorkbookLinks> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) {
    console.error("[postal] SHAREPOINT_DRIVE_ID 미설정");
    return NONE;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[postal] Graph 토큰 획득 실패:", e);
    return NONE;
  }

  const [ledgerUrl, pettyCashUrl] = await Promise.all([
    fetchWebUrl(token, driveId, process.env.SHAREPOINT_MAIL_ITEM_ID),
    fetchWebUrl(token, driveId, process.env.SHAREPOINT_PETTY_CASH_ITEM_ID),
  ]);
  return { ledgerUrl, pettyCashUrl };
}
