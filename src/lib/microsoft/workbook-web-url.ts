import "server-only";

/**
 * 원본 엑셀 바로가기 링크 하나 — SharePoint driveItem 의 `webUrl`.
 *
 * 미수채권과 우편물이 각자 같은 함수를 갖고 있었고 계약이 **세 번째**가 될
 * 참이었다. 이 레포의 기록이 그 지점을 정확히 짚는다 — "세 번째로 옮겨 적을 때
 * 결국 다른 치수가 들어갔다"(`HeaderActionButton`).
 *
 * **던지지 않는다.** 링크 하나 때문에 목록까지 죽으면 안 되고, 깨진 링크를
 * 누르게 하느니 버튼을 안 그리는 편이 낫다 — 실패는 `null` 로 온다.
 *
 * @param label 로그에 찍을 도메인 이름(`계약`·`미수채권`…). 어느 화면의 링크가
 *   안 뜨는지 로그만 보고 알 수 있어야 한다.
 */
export async function fetchWorkbookWebUrl(
  token: string,
  driveId: string,
  itemId: string | undefined,
  label: string,
): Promise<string | null> {
  if (!itemId) return null;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}?$select=webUrl`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.error(`[${label}] webUrl 조회 실패 (item=${itemId}): ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { webUrl?: string };
    return json.webUrl ?? null;
  } catch (e) {
    console.error(`[${label}] webUrl 조회 예외 (item=${itemId}):`, e);
    return null;
  }
}
