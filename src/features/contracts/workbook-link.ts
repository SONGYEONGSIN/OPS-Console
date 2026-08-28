import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { fetchWorkbookWebUrl } from "@/lib/microsoft/workbook-web-url";

/**
 * 계약관리대장 원본 엑셀 바로가기.
 *
 * 계약 목록은 이 파일(`SHAREPOINT_CONTRACTS_ITEM_ID`)의 사본이다. 원본으로 가는
 * 길이 화면에 없으면 고칠 게 있을 때 파일을 따로 찾아 헤매게 된다 — 미수채권과
 * 우편물이 이미 같은 버튼을 갖고 있다.
 *
 * **던지지 않는다.** 링크 하나 때문에 계약 목록까지 못 뜨면 안 된다.
 */
export async function getContractsWorkbookUrl(): Promise<string | null> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) {
    console.error("[contracts] SHAREPOINT_DRIVE_ID 미설정");
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[contracts] Graph 토큰 획득 실패:", e);
    return null;
  }

  return fetchWorkbookWebUrl(
    token,
    driveId,
    process.env.SHAREPOINT_CONTRACTS_ITEM_ID,
    "contracts",
  );
}
