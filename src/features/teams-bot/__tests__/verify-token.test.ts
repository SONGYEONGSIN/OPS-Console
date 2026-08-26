import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { verifyBotToken, BOT_ISSUER } from "../verify-token";

/**
 * Bot Framework 가 보낸 요청인지 확인한다.
 *
 * `/api/teams/messages` 주소는 공개돼 있다. 검증이 없으면 **아무나 남의 이름으로**
 * 질문을 넣을 수 있고, 어시스턴트는 인수인계·연락처 같은 내부 기록을 읽는다.
 *
 * `serviceUrl` 까지 대조하는 이유: 그 값으로 답을 보내는데, 본문만 믿으면
 * **답을 남의 서버로 보내게** 만들 수 있다.
 */
let key: Awaited<ReturnType<typeof generateKeyPair>>;
const APP_ID = "0a63cfbf-fc4c-4a8c-83ba-f29bd33274a1";
const SERVICE_URL = "https://smba.trafficmanager.net/kr/";

async function tokenWith(over: Record<string, unknown> = {}, signWith?: CryptoKey) {
  const claims = { serviceurl: SERVICE_URL, ...over };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(String(over.iss ?? BOT_ISSUER))
    .setAudience(String(over.aud ?? APP_ID))
    .setExpirationTime(String(over.exp ?? "5m"))
    .sign(signWith ?? key.privateKey);
}

beforeEach(async () => {
  key = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(key.publicKey)), kid: "test-kid", alg: "RS256", use: "sig" };
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          String(url).includes("openid")
            ? { jwks_uri: "https://login.botframework.com/v1/.well-known/keys" }
            : { keys: [jwk] },
        ),
    }),
  ));
});

describe("verifyBotToken", () => {
  it("제대로 서명된 토큰을 받아들인다", async () => {
    const r = await verifyBotToken(`Bearer ${await tokenWith()}`, APP_ID, SERVICE_URL);
    expect(r.ok).toBe(true);
  });

  it("Bearer 가 없으면 거절한다", async () => {
    expect((await verifyBotToken(await tokenWith(), APP_ID, SERVICE_URL)).ok).toBe(false);
    expect((await verifyBotToken(null, APP_ID, SERVICE_URL)).ok).toBe(false);
  });

  it("남의 키로 서명한 토큰을 거절한다 — 핵심 방어다", async () => {
    const other = await generateKeyPair("RS256");
    const t = await tokenWith({}, other.privateKey);
    expect((await verifyBotToken(`Bearer ${t}`, APP_ID, SERVICE_URL)).ok).toBe(false);
  });

  it("발급자가 다르면 거절한다", async () => {
    const t = await tokenWith({ iss: "https://evil.example.com" });
    expect((await verifyBotToken(`Bearer ${t}`, APP_ID, SERVICE_URL)).ok).toBe(false);
  });

  it("다른 봇 앞으로 온 토큰을 거절한다", async () => {
    const t = await tokenWith({ aud: "다른-app-id" });
    expect((await verifyBotToken(`Bearer ${t}`, APP_ID, SERVICE_URL)).ok).toBe(false);
  });

  it("만료된 토큰을 거절한다", async () => {
    const t = await tokenWith({ exp: "-1m" });
    expect((await verifyBotToken(`Bearer ${t}`, APP_ID, SERVICE_URL)).ok).toBe(false);
  });

  it("본문의 serviceUrl 이 토큰과 다르면 거절한다 — 답을 남의 서버로 보내지 않는다", async () => {
    const t = await tokenWith();
    const r = await verifyBotToken(`Bearer ${t}`, APP_ID, "https://evil.example.com/");
    expect(r.ok).toBe(false);
  });
});
