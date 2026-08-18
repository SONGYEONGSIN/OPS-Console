import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchDomainsWith } from "@/features/assistant/search";
import { authorizeToolRequest } from "@/features/assistant/tool-auth";

/**
 * 어시스턴트 도구 — 운영 데이터 검색. `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Claude 모드는 볼트만 읽어서 운영 데이터에 닿는 길이 없었다. 부산대 인수인계
 * 3,155자가 DB에 있는데 "넣을 내용이 아직 없습니다"라고 답한 것이 그 결과다.
 *
 * **요청자 검증이 이 라우트의 존재 이유다.** 7개 테이블의 RLS가
 * `for select to authenticated using (true)`라 행은 안 걸러진다(2026-08-18 확인).
 * 관리자 클라이언트를 쓰든 세션 클라이언트를 쓰든 같은 행이 나온다. 그래서 권한은
 * 여기서 **사람 단위로** 건다 — 없는 사람, 비활성, viewer는 답을 못 받는다.
 *
 * 설계: docs/superpowers/specs/2026-08-18-assistant-tools-design.md
 */

const querySchema = z.object({
  q: z.string().trim().min(1, "q는 필수").max(4000),
  // 누가 묻는지 모르면 답하지 않는다. 폴러가 큐의 operator_email을 그대로 넘긴다 —
  // 그 값의 출처는 웹 세션이라 사용자가 위조할 수 없다.
  as: z.string().trim().min(1, "as는 필수"),
});

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    q: sp.get("q") ?? undefined,
    as: sp.get("as") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: operator } = await admin
    .from("operators")
    .select("email, permission, status")
    .eq("email", parsed.data.as)
    .maybeSingle();

  const auth = authorizeToolRequest(
    operator as { permission: string | null; status: string | null } | null,
  );
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }
  const allowed = auth.allowed;

  const sources = await searchDomainsWith(admin, { question: parsed.data.q });
  return NextResponse.json({
    ok: true,
    sources: sources.filter((s) => allowed.has(s.domain)),
  });
}
