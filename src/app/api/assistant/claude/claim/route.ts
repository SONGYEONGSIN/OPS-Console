import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildVaultPrompt,
  collectSourcePaths,
  type SdkToolUse,
} from "@/features/assistant/claude-prompt";

/**
 * 어시스턴트 Claude 모드 폴러 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 회사 PC 상주 폴러(scripts/assistant/serve-local.mjs)가 2초마다 호출한다.
 *   GET  → 가장 오래된 pending 1건을 원자적 claim(→running). 없으면 { request: null }.
 *   POST → 완료 보고 { id, ok, answer, toolUses, vaultRoot, message } → done/failed.
 * dev-controls/analyze-request와 동형이되, 답·근거를 함께 받아 적는 점만 다르다.
 *
 * **판단은 전부 여기 있고 폴러는 실행만 한다** — 프롬프트를 만들어 내려주고, 근거도
 * 폴러가 보낸 tool_use에서 서버가 뽑는다. 프롬프트나 추출 규칙을 고칠 때 회사 PC를
 * 만지지 않아도 되고, 그 로직이 테스트 도는 곳에 남는다.
 */

function authorized(request: NextRequest, secret: string): boolean {
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function guard(request: NextRequest): NextResponse | string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  return secret;
}

export async function GET(request: NextRequest) {
  const g = guard(request);
  if (typeof g !== "string") return g;

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("assistant_requests")
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, request: null });
  }

  // 원자적 claim — 아직 pending일 때만 running으로 전환(동시 폴러 경합 방지)
  const { data: claimed, error } = await admin
    .from("assistant_requests")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select("id, question, page_context, operator_email")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  if (!claimed) {
    // 경합으로 다른 폴러가 가져감
    return NextResponse.json({ ok: true, request: null });
  }

  const row = claimed as {
    id: string;
    question: string;
    page_context: string | null;
    operator_email: string;
  };
  return NextResponse.json({
    ok: true,
    request: {
      ...row,
      prompt: buildVaultPrompt({
        question: row.question,
        pageContext: row.page_context,
      }),
    },
  });
}

/** 답이 길어도 UI가 감당할 만큼만 — 토큰이 아니라 화면 기준이다. */
const ANSWER_MAX = 12000;

export async function POST(request: NextRequest) {
  const g = guard(request);
  if (typeof g !== "string") return g;

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    ok?: unknown;
    answer?: unknown;
    toolUses?: unknown;
    vaultRoot?: unknown;
    message?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("assistant_requests")
    .update({
      status: body.ok === true ? "done" : "failed",
      answer:
        typeof body.answer === "string" ? body.answer.slice(0, ANSWER_MAX) : null,
      sources:
        Array.isArray(body.toolUses) && typeof body.vaultRoot === "string"
          ? collectSourcePaths(body.toolUses as SdkToolUse[], body.vaultRoot)
          : [],
      message:
        typeof body.message === "string" ? body.message.slice(0, 500) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
