import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Bot Framework 가 보낸 요청인지 확인한다.
 *
 * `/api/teams/messages` 주소는 공개돼 있다. 검증이 없으면 **아무나 남의 이름으로**
 * 질문을 넣을 수 있고, 어시스턴트는 인수인계·연락처 같은 내부 기록을 읽는다.
 *
 * `serviceUrl` 까지 대조하는 이유: 그 값으로 답을 되돌려 보내는데, 본문만 믿으면
 * **답을 남의 서버로 보내게** 만들 수 있다. 토큰 안의 값과 같아야 한다.
 */

export const BOT_ISSUER = "https://api.botframework.com";
const OPENID_CONFIG =
  "https://login.botframework.com/v1/.well-known/openidconfiguration";

/**
 * JWKS 는 모듈 수준에 캐시한다 — Teams 는 15초 안에 응답을 기대하는데
 * 매번 키를 받아오면 그 예산을 네트워크로 다 쓴다.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getJwks() {
  if (jwks) return jwks;
  const res = await fetch(OPENID_CONFIG);
  if (!res.ok) throw new Error(`openid 구성 조회 실패 ${res.status}`);
  const { jwks_uri } = (await res.json()) as { jwks_uri: string };
  jwks = createRemoteJWKSet(new URL(jwks_uri));
  return jwks;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function verifyBotToken(
  authorization: string | null,
  appId: string,
  serviceUrl: string,
): Promise<VerifyResult> {
  if (!authorization?.startsWith("Bearer ")) {
    return { ok: false, reason: "Bearer 토큰이 없습니다" };
  }
  const token = authorization.slice("Bearer ".length).trim();

  try {
    const { payload } = await jwtVerify(token, await getJwks(), {
      issuer: BOT_ISSUER,
      audience: appId,
    });
    // 답을 보낼 주소다. 본문 값을 그대로 믿으면 답이 남의 서버로 간다.
    const claimed = String(payload.serviceurl ?? "");
    if (normalize(claimed) !== normalize(serviceUrl)) {
      return { ok: false, reason: "serviceUrl 이 토큰과 다릅니다" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "검증 실패" };
  }
}

/** 끝의 슬래시 하나로 거절하지 않는다 — 같은 주소를 다르게 쓰는 경우가 있다. */
function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}
