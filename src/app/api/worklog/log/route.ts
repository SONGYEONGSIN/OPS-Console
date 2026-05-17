import { NextResponse } from "next/server";
import { logActivity } from "@/features/worklog/log";
import { worklogInsertSchema } from "@/features/worklog/schemas";

/**
 * 클라이언트 측 이벤트 로깅 endpoint.
 * - 페이지 진입/이탈 (PageActivityLogger)
 * - 인스펙터 row 클릭 (ListPattern dispatcher)
 * - 메뉴 닫기 등
 *
 * fetch 또는 navigator.sendBeacon 으로 호출. auth는 logActivity 내부의
 * getCurrentOperator()가 cookie로 처리 (미인증이면 user_email=null로 기록).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = worklogInsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }
  await logActivity(parsed.data);
  return NextResponse.json({ ok: true });
}
