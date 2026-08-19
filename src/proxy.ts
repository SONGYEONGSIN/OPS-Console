import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** 인증 없이 접근 가능한 라우트. 정확 일치 또는 prefix 매치.
 *  /api/data-requests/dispatch — pg_cron이 쿠키 세션 없이 호출. 라우트 내부에서
 *  /api/backup-requests/dispatch — 동일 (PR-6 예약 발송 cron 진입점)
 *  /api/automations/run — GitHub Actions / 외부 cron 진입점 (receivables 등 jobId 자동화).
 *  /api/closing/ingest — Moa 스크래퍼(GitHub Actions)가 마감 스냅샷을 적재.
 *  /api/closing/run-log — 스크래퍼가 실행 결과(success/skipped/failed)를 보고.
 *  /api/closing/scrape-request — 회사 PC 폴러가 로컬 실행 요청을 claim/완료 보고.
 *  /api/entertest/test-request — 회사 PC 폴러가 테스트 실행 요청을 claim/완료 보고.
 *  /api/entertest/ingest — entertest 테스트 러너가 케이스별 결과를 적재.
 *  /api/dev-controls/analyze-request — 회사 PC 폴러가 개발탭 수동 분석 요청을 claim/완료 보고.
 *  /api/assistant/claude/claim — 회사 PC 상주 폴러가 어시스턴트 질문을 claim/답 보고.
 *  /api/postal/extract — 회사 PC 폴러가 영수증 판독 요청을 claim/결과 보고.
 *  /api/assistant/tools — 폴러가 Claude에게 붙여준 도구가 호출(일정 조회 등).
 *    접두사 매칭이라 이 아래 새 라우트는 자동으로 public이 된다 — 반드시
 *    라우트 안에서 CRON_SECRET을 검사할 것.
 *    (웹 창구 /api/assistant/claude 는 세션이 필요하므로 여기 넣지 않는다.)
 *  /api/team-briefing — 상시 맥 launchd가 주간 브리핑 초안 조회(draft)/발행(publish).
 *  /api/ratio-audit — 로컬 경쟁률 세팅 점검 스크래퍼(scripts/moa-ratio/audit.py)가
 *  대상 조회(targets)/결과 인제스트(ingest)에 호출.
 *  CRON_SECRET 헤더로 자체 인증하므로 미들웨어 인증 가드는 통과시킨다. */
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/api/data-requests/dispatch",
  "/api/backup-requests/dispatch",
  "/api/automations/run",
  "/api/closing/ingest",
  "/api/closing/run-log",
  "/api/closing/scrape-request",
  "/api/ai-tips/candidates",
  "/api/entertest/test-request",
  "/api/entertest/ingest",
  "/api/dev-controls/analyze-request",
  "/api/assistant/claude/claim",
  "/api/assistant/tools",
  "/api/postal/extract",
  "/api/team-briefing",
  "/api/ratio-audit",
  /** 분석보고서 외부 공유 — share_token 으로 접근. 토큰 검증은 라우트 내부에서. */
  "/r",
];

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // 미인증 + 비공개 → /login으로 보냄
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 이미 로그인했는데 /login 접근 → /dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
