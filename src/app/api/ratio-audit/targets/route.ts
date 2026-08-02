import { NextResponse } from "next/server";
import { listRatioAuditTargets } from "@/features/ratio-audit/queries";

/**
 * 경쟁률 세팅 점검 대상 목록 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 로컬 스크래퍼(scripts/moa-ratio/audit.py)가 순회 대상을 받아간다.
 * 읽기 전용이며 대학명·담당자만 나가므로 secret 누설 시 영향은 정보 노출 한정.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const targets = await listRatioAuditTargets();
    return NextResponse.json({ ok: true, targets });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
