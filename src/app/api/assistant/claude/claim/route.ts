import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GAP_DRAFT_MARKER } from "@/features/knowledge/gaps-types";
import {
  buildVaultPrompt,
  type ChatTurn,
  collectSourcePaths,
  kstToday,
  proposalPathFromToolUses,
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

/**
 * 이 시간 넘게 running이면 그 폴러는 죽은 것으로 본다.
 *
 * 폴러가 claim한 뒤 죽으면(프로세스 종료·맥 절전) 그 행은 영원히 running에
 * 남는다 — 실제로 그렇게 박힌 요청이 있었다. 클라이언트는 3분에 끊고, 폴러
 * 자체 타임아웃도 3분이라 5분이면 살아 있는 작업을 뺏지 않는다.
 *
 * 되살리지 않고 실패로 닫는 이유: 3분 전에 물어본 사람은 이미 화면을 떠났고,
 * 아무도 안 보는 답을 다시 만드는 건 구독 사용량만 쓴다.
 */
const STALE_RUNNING_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const g = guard(request);
  if (typeof g !== "string") return g;

  const admin = createAdminClient();

  await admin
    .from("assistant_requests")
    .update({
      status: "failed",
      message: "폴러가 응답 없이 중단됐습니다",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("claimed_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());

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
    .select("id, question, page_context, operator_email, history")
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

  // 열린 빈틈 주제를 프롬프트에 실어 같은 주제가 갈라지는 것을 막는다.
  // 표기 정규화(gaps-shared)로는 '연락처' vs '전화·이메일'처럼 낱말이 다른
  // 중복을 못 잡는데, 모델에게 기존 이름을 보여주면 그대로 쓴다.
  const { data: gapRows } = await admin
    .from("knowledge_gaps")
    .select("topic")
    .eq("status", "open")
    .limit(200);
  const openTopics = [
    ...new Set(((gapRows ?? []) as { topic: string }[]).map((g) => g.topic)),
  ];

  const row = claimed as {
    id: string;
    question: string;
    page_context: string | null;
    operator_email: string;
    history: ChatTurn[] | null;
  };
  return NextResponse.json({
    ok: true,
    request: {
      ...row,
      prompt: buildVaultPrompt({
        openTopics,
        // 빈틈 화면의 '초안 요청'이 만든 문구인지 본다. 그 경로에서 거절하면
        // 모델이 또 report_gap 을 불러 누를수록 목록이 늘었다.
        fromGapDraft: row.question.includes(GAP_DRAFT_MARKER),
        question: row.question,
        pageContext: row.page_context,
        // 폴러 PC의 시계를 믿지 않는다 — 어긋나면 "다음주"가 통째로 밀린다.
        today: kstToday(),
        // 앞서 주고받은 것. 몇 턴을 실을지는 buildVaultPrompt가 자른다.
        history: row.history ?? [],
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

  // 초안이 만들어졌으면 같은 대화의 빈틈이 그걸 가리키게 한다.
  //
  // 폴러가 따로 알려주지 않아도 된다 — 보고에 모든 tool_use가 실려 오므로
  // propose_doc 호출이 그 안에 있다. 여기서 뽑으면 **회사 PC를 안 만지고도**
  // 연결이 되고, 폴러에 판단을 두지 않는다는 원칙과도 맞는다.
  const toolUses = Array.isArray(body.toolUses)
    ? (body.toolUses as SdkToolUse[])
    : [];
  const proposalPath = proposalPathFromToolUses(toolUses);
  if (proposalPath) {
    await admin
      .from("knowledge_gaps")
      .update({ proposal_path: proposalPath })
      .eq("request_id", id)
      // 이미 닫은 빈틈은 건드리지 않는다 — 다시 열린 것처럼 보이면 안 된다.
      .eq("status", "open");
  }

  return NextResponse.json({ ok: true });
}
