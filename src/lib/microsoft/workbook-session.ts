import "server-only";
import { getGraphToken } from "./auth";

/**
 * Microsoft Graph Excel — Workbook session 관리.
 *
 * 첫 PATCH/POST가 워크북을 메모리에 활성화하는데 SharePoint Excel이 클수록
 * 활성화에 수십 초 이상 걸려 504 MaxRequestDurationExceeded 가 발생한다.
 * createSession(persistChanges:true) 으로 세션 ID 한 번 받아두면 모든 후속
 * 호출이 활성 메모리에서 처리되어 빠르고 안정적.
 *
 * 세션 수명: Microsoft 측 약 7분 (활동 없음 시). 안전 마진 두고 5분 캐시.
 */

type SessionCacheEntry = {
  sessionId: string;
  expiresAt: number;
};

const SESSION_TTL_MS = 5 * 60 * 1000; // 5분
const cache = new Map<string, SessionCacheEntry>();

function cacheKey(driveId: string, itemId: string): string {
  return `${driveId}/${itemId}`;
}

/**
 * 워크북 세션 ID 발급 — driveId/itemId 단위 캐시.
 * persistChanges:true 로 PATCH 결과가 영구 저장됨.
 */
export async function getWorkbookSession(
  driveId: string,
  itemId: string,
): Promise<string> {
  const key = cacheKey(driveId, itemId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sessionId;
  }
  return refreshWorkbookSession(driveId, itemId);
}

/**
 * 세션 강제 재발급 — 504/만료 후 retry 시 사용.
 * 401(InvalidAuthenticationToken) 응답 시 token 캐시 강제 갱신 후 1회 자동 재시도.
 */
export async function refreshWorkbookSession(
  driveId: string,
  itemId: string,
): Promise<string> {
  const key = cacheKey(driveId, itemId);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/createSession`;

  const callOnce = async (forceRefresh: boolean): Promise<Response> => {
    const token = await getGraphToken(forceRefresh ? { forceRefresh: true } : undefined);
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ persistChanges: true }),
    });
  };

  let res = await callOnce(false);
  if (res.status === 401) {
    res = await callOnce(true);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `[workbook session] createSession ${res.status}: ${errText.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { id: string };
  cache.set(key, {
    sessionId: json.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return json.id;
}

export function __resetWorkbookSessionCache(): void {
  cache.clear();
}
