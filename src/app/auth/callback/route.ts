import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth callback (SSO) + 비밀번호 reset 메일 링크의 진입점.
 * `next` 파라미터로 redirect 분기 — 미지정 시 /dashboard.
 *
 * recovery 흐름(next=/reset-password) 에러는 /forgot-password로 보내고
 * error_code별 한국어 메시지를 노출 (OAuth 흐름과 분리).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const isRecovery = next === "/reset-password";

  if (oauthError) {
    if (isRecovery) {
      const reason = errorCode === "otp_expired" ? "link_expired" : "link_invalid";
      return NextResponse.redirect(`${origin}/forgot-password?error=${reason}`);
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
  if (!code) {
    if (isRecovery) {
      return NextResponse.redirect(`${origin}/forgot-password?error=link_invalid`);
    }
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (isRecovery) {
      return NextResponse.redirect(`${origin}/forgot-password?error=link_invalid`);
    }
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // OAuth(azure) 로그인 → SharePoint 위임 업로드용 provider refresh token 저장.
  // recovery 흐름 제외. 저장 실패해도 로그인은 막지 않는다.
  const session = data?.session;
  const email = session?.user?.email;
  const refreshToken = session?.provider_refresh_token;
  if (!isRecovery && email && refreshToken) {
    try {
      const admin = createAdminClient();
      await admin.from("operator_ms_tokens").upsert(
        {
          operator_email: email,
          provider_refresh_token: refreshToken,
          scope: "Files.ReadWrite.All Sites.ReadWrite.All offline_access",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "operator_email" },
      );
    } catch (e) {
      console.error("[auth/callback] ms token 저장 실패:", e);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
