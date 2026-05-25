import "server-only";

type CachedToken = { token: string; expiresAt: number };
let cache: CachedToken | null = null;

/**
 * Azure AD client_credentials grant — Microsoft Graph용 access_token.
 * 메모리 캐시 (Node process 단위) — exp 300s(5분) 전에 재발급(시계 스큐 마진).
 * 호출자가 401을 만나면 forceRefresh:true 로 캐시 무시하고 재발급 가능.
 *
 * 환경변수: AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET
 */
export async function getGraphToken(opts?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const tenant = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const secret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenant || !clientId || !secret) {
    throw new Error(
      "[graph auth] AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET 환경 변수 필요",
    );
  }

  // 캐시 hit (forceRefresh 시 우회)
  if (!opts?.forceRefresh && cache && cache.expiresAt - 300_000 > Date.now()) {
    return cache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: secret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[graph auth] ${res.status} ${errText}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cache = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

/** 테스트용 캐시 리셋 */
export function __resetTokenCache() {
  cache = null;
}
