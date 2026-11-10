import { NextResponse } from "next/server";
import { z } from "zod";
import { loadRequestFilters } from "@/features/ratio-audit/audit-requests/request-filters";
import { listRatioAuditTargets } from "@/features/ratio-audit/queries";
import { conditionLine } from "@/features/ratio-audit/run-filters";

const querySchema = z.object({ requestId: z.string().uuid() });

// 오류 본문의 code 는 ASCII — 폴러 완료 보고가 PS 5.1 문자열 본문이라 한글이 깨질 수 있다
function fail(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

/**
 * 경쟁률 세팅 점검 대상 목록 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 로컬 스크래퍼(scripts/moa-ratio/audit.py)가 순회 대상을 받아간다.
 * 읽기 전용이며 대학명·담당자만 나가므로 secret 누설 시 영향은 정보 노출 한정.
 *
 * 대상은 요청 행의 실행 조건으로 서버가 고른다 — 폴러는 id 만 넘긴다(PS 5.1 이 한글
 * 조건을 깨뜨리지 않게). 요청 상태는 보지 않는다(시험 실행이 기존 id 를 다시 쓸 수 있게).
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
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const query = querySchema.safeParse({
    requestId: new URL(request.url).searchParams.get("requestId") ?? "",
  });
  if (!query.success) {
    return fail(400, "bad_request", "requestId(uuid)가 필요합니다.");
  }
  const { requestId } = query.data;

  try {
    const lookup = await loadRequestFilters(requestId);
    if (lookup.status === "not_found") {
      return fail(404, "not_found", "실행 요청을 찾지 못했습니다.");
    }
    if (lookup.status === "missing_filters") {
      return fail(
        409,
        "missing_filters",
        "실행 조건이 없는 요청입니다 — 자동화 페이지에서 조건을 골라 다시 실행하세요.",
      );
    }
    const targets = await listRatioAuditTargets(lookup.filters, new Date());
    return NextResponse.json({
      ok: true,
      targets,
      condition: {
        requestId,
        line: conditionLine(lookup.filters, targets.length),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
