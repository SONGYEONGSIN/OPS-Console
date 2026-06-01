import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 운영자별 MS 위임 Graph access token.
 *
 * 로그인(OAuth) 콜백에서 저장한 provider_refresh_token으로 Azure 토큰 엔드포인트에서
 * 위임 access token을 발급한다. 이 토큰으로 SharePoint 업로드 시 "만든 사람"=운영자.
 * refresh token은 회전(rotation)되므로 새 값을 다시 저장한다.
 *
 * 실패 시(저장된 토큰 없음/갱신 실패) null → 호출자가 서비스 계정으로 폴백.
 */

const DELEGATED_SCOPE = "offline_access Files.ReadWrite.All Sites.ReadWrite.All";

export async function getDelegatedGraphToken(
  operatorEmail: string,
): Promise<string | null> {
  const tenant = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const secret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenant || !clientId || !secret) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("operator_ms_tokens")
    .select("provider_refresh_token")
    .eq("operator_email", operatorEmail)
    .maybeSingle();
  const refreshToken = row?.provider_refresh_token;
  if (!refreshToken) return null;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: secret,
        refresh_token: refreshToken,
        scope: DELEGATED_SCOPE,
      }),
    },
  );
  if (!res.ok) {
    console.error(
      `[delegated-token] refresh 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    return null;
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!json.access_token) return null;

  // refresh token 회전 → 새 값 저장
  if (json.refresh_token && json.refresh_token !== refreshToken) {
    await admin
      .from("operator_ms_tokens")
      .update({
        provider_refresh_token: json.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq("operator_email", operatorEmail);
  }

  return json.access_token;
}
