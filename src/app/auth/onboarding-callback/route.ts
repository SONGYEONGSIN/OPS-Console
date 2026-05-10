import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /auth/onboarding-callback — Supabase Auth invite 수락 후 redirect 처리.
 *
 * 흐름:
 * 1. 신입이 메일 invite 클릭 → Supabase가 verify 후 본 라우트로 redirect (PKCE: ?code=...)
 * 2. exchangeCodeForSession → cookie session 설정
 * 3. trainee_email = user.email 매칭 cohort 찾아 accepted_at + status 갱신 (admin client, 첫 수락만)
 * 4. /dashboard/onboarding?welcome=1 redirect (회차 없으면 /dashboard fallback)
 *
 * 비밀번호 설정 페이지는 후속 epic.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error_description");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=invite-no-code", url.origin),
    );
  }

  const supabase = await createClient();
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user?.email) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          exchangeError?.message ?? "exchange-failed",
        )}`,
        url.origin,
      ),
    );
  }

  const email = data.user.email;
  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("onboarding_cohorts")
    .select("id, status, accepted_at")
    .eq("trainee_email", email)
    .maybeSingle();

  let nextPath = "/dashboard";
  if (cohort) {
    if (!cohort.accepted_at) {
      await admin
        .from("onboarding_cohorts")
        .update({
          accepted_at: new Date().toISOString(),
          status: cohort.status === "planned" ? "in_progress" : cohort.status,
        })
        .eq("id", cohort.id);
    }
    nextPath = "/dashboard/onboarding?welcome=1";
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
