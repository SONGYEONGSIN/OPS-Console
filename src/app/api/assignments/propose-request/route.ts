import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { loadJudgeInput } from "@/features/assignments/proposal/judge-input";
import { parseProposalResponse } from "@/features/assignments/proposal/parse-response";
import { runGates } from "@/features/assignments/proposal/gate";
import { persistProposalBatch } from "@/features/assignments/proposal/persist";
import { proposalBatchHtml } from "@/features/assignments/proposal/report";
import { sendAutomationReport } from "@/features/automations/report-send";

/**
 * 배정 판정 폴러 창구(설계 §6.4) — `Authorization: Bearer ${CRON_SECRET}`.
 * 회사 PC 폴러(`scripts/assignments/propose-local.mjs`)가 호출한다.
 *
 *   GET  → 가장 오래된 `pending` 1건을 **원자적 claim**(→`running`) + **프롬프트**.
 *   POST → 모델 응답 원문 회신 → **여기서 검산하고 적재**한다.
 *
 * **폴러는 에이전트만 돌린다.** 프롬프트 조립도 응답 검산도 서버가 한다(§6.3 ·
 * 어시스턴트 선례) — 게이트를 회사 PC 로 내보내면 검산이 두 곳에 생기고, 그 PC 의
 * 코드가 낡은 채로 통과시킨 배치를 아무도 못 알아챈다.
 *
 * `PUBLIC_PATHS` 에 있어야 307 로 `/login` 에 안 걸린다(`proxy-cron-paths.test.ts`).
 */

/**
 * 판정 실패가 붙는 잡. **적재 잡과 같은 id 를 쓴다** — 판정은 잡이 아니라서(§6.4)
 * 자기 이력 줄이 없고, 실패를 어디에도 안 붙이면 그 실패는 아무 보고에도 안 나온다.
 */
const JUDGE_FAILURE_JOB_ID = "assignment-year-rollover";

const TABLE = "assignment_propose_requests";

type ClaimedRequest = {
  id: string;
  requested_by: string;
  academic_year: number;
  kind: "annual" | "single";
  university_name: string | null;
  work_kind: string | null;
};

const CLAIM_COLUMNS =
  "id, requested_at, requested_by, academic_year, kind, university_name, work_kind";

function unauthorized(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  // 설정 누락을 401 로 숨기지 않는다 — 폴러는 '키가 틀렸나' 를 영원히 고치려 든다.
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
  return null;
}

/** 단건 요청의 대상. `annual` 은 학년도 전체라 대상이 없다. */
const onlyOf = (r: ClaimedRequest) =>
  r.kind === "single" && r.university_name && r.work_kind
    ? { university_name: r.university_name, work_kind: r.work_kind }
    : undefined;

/**
 * 요청을 마감한다. **실패는 자동화 이력에도 흘린다** — 회사 PC 잡은 이 보고가
 * 유일한 창구라, 여기서 안 남기면 폴러가 죽어도 화면엔 큐 적재의 '성공' 만 떠
 * 있다(경쟁률 점검이 그렇게 걸렸다, 2026-08-19).
 */
async function finish(
  id: string,
  outcome:
    | { ok: true; batchId: string; message: string }
    | { ok: false; message: string },
) {
  const admin = createAdminClient();
  await admin
    .from(TABLE)
    .update({
      status: outcome.ok ? "done" : "failed",
      finished_at: new Date().toISOString(),
      batch_id: outcome.ok ? outcome.batchId : null,
      message: outcome.message.slice(0, 500),
    })
    .eq("id", id);

  if (!outcome.ok) {
    await recordAutomationRun(JUDGE_FAILURE_JOB_ID, {
      ok: false,
      message: outcome.message.slice(0, 500),
    });
  }
}

export async function GET(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: pending, error: selErr } = await admin
    .from(TABLE)
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  // **조용한 빈손을 만들지 않는다** — 폴러에게 `null` 은 '할 일이 없다' 라서,
  // 조회 실패를 그것으로 돌려주면 큐가 밀리는데 폴러는 한가한 줄 안다.
  if (selErr) {
    return NextResponse.json(
      { ok: false, error: selErr.message },
      { status: 500 },
    );
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, request: null });
  }

  // 원자적 claim — 아직 pending 일 때만 running 으로 전환(동시 폴러 경합 방지).
  const { data: claimed, error } = await admin
    .from(TABLE)
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select(CLAIM_COLUMNS)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  // 경합으로 다른 폴러가 가져갔으면 빈손이다.
  if (!claimed) return NextResponse.json({ ok: true, request: null });

  const claimedRequest = claimed as ClaimedRequest;
  try {
    const { prompt, promptHash } = await loadJudgeInput(
      claimedRequest.academic_year,
      new Date(),
      onlyOf(claimedRequest),
    );
    return NextResponse.json({
      ok: true,
      request: claimedRequest,
      prompt,
      promptHash,
    });
  } catch (e) {
    // **그 자리에서 마감한다.** running 으로 두면 30분간 큐가 잠기고, 폴러는
    // 500 만 보고 왜인지 모른 채 5분마다 다시 온다.
    const message = e instanceof Error ? e.message : "판정 입력 조립 실패";
    await finish(claimedRequest.id, { ok: false, message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    ok?: unknown;
    verdictRaw?: unknown;
    model?: unknown;
    promptHash?: unknown;
    message?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  }

  // 폴러가 스스로 실패를 알린 경우 — 에이전트가 안 돌았거나 시간이 넘었다.
  if (body.ok !== true) {
    const message =
      typeof body.message === "string"
        ? body.message
        : "회사 PC 폴러 판정 실패";
    await finish(id, { ok: false, message });
    return NextResponse.json({ ok: true });
  }

  const verdictRaw = typeof body.verdictRaw === "string" ? body.verdictRaw : "";
  const model = typeof body.model === "string" ? body.model : "unknown";
  const promptHash =
    typeof body.promptHash === "string" ? body.promptHash : "unknown";

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from(TABLE)
    .select(CLAIM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (rowErr || !row) {
    return NextResponse.json(
      { ok: false, error: rowErr?.message ?? "요청을 찾을 수 없습니다" },
      { status: 404 },
    );
  }
  const req = row as ClaimedRequest;

  try {
    // **지금 원장을 다시 읽는다.** 판정이 도는 사이 사람이 손으로 고쳤을 수 있고,
    // G2(경합)가 그걸 보고 떨궈야 한다(§5.4).
    const { candidates, groups, gateContext } = await loadJudgeInput(
      req.academic_year,
      new Date(),
      onlyOf(req),
    );

    const parsed = parseProposalResponse(verdictRaw, candidates);
    if (!parsed.ok) {
      await finish(id, { ok: false, message: `응답 거부: ${parsed.error}` });
      return NextResponse.json({ ok: false, error: parsed.error });
    }

    const gated = runGates(parsed.moves, gateContext);
    const persisted = await persistProposalBatch({
      academicYear: req.academic_year,
      kind: req.kind,
      requestedBy: req.requested_by,
      groups,
      ledger: gateContext.ledger,
      gateResult: gated,
      model,
      promptHash,
      verdictRaw,
    });
    if (!persisted.ok) {
      await finish(id, { ok: false, message: persisted.error });
      return NextResponse.json(
        { ok: false, error: persisted.error },
        { status: 500 },
      );
    }

    await finish(id, {
      ok: true,
      batchId: persisted.batchId,
      message: persisted.summary,
    });

    /**
     * **성공은 여기서만 사람에게 닿는다.** 판정은 잡이 아니라서(§6.4) 성공에
     * `automation_runs` 줄이 안 생기고 일일 보고에도 안 잡힌다 — 이 메시지가 없으면
     * 배치는 제안 탭 안에만 있고, 그 탭을 열어 볼 이유가 아무에게도 생기지 않는다.
     *
     * 발송 실패가 판정을 뒤집지는 않는다(`sendAutomationReport` 는 던지지 않는다).
     */
    await sendAutomationReport(
      proposalBatchHtml({
        academicYear: req.academic_year,
        kind: req.kind,
        proposals: persisted.proposals,
        universities: new Set(gated.accepted.map((m) => m.university_name))
          .size,
        summary: persisted.summary,
        batchId: persisted.batchId,
        target: onlyOf(req),
      }),
    );

    return NextResponse.json({
      ok: true,
      batchId: persisted.batchId,
      summary: persisted.summary,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "판정 검산 실패";
    await finish(id, { ok: false, message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
