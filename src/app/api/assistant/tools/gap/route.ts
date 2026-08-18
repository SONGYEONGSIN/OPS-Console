import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 어시스턴트 도구 — 답하지 못한 것을 기록한다. `Authorization: Bearer ${CRON_SECRET}`.
 *
 * "볼트에 없습니다"는 지금까지 답변 본문 안 문장으로만 존재해 기계가 못 읽었다.
 * 에이전트가 직접 남기게 해서 무엇이 없어 못 답했는지를 세 갈래로 구분한다.
 *
 * 구분이 이 기능의 핵심이다 — '문서 없음'과 '깊이 부족'을 섞으면 이미 있는
 * 문서의 중복본을 만들게 된다.
 */

const gapSchema = z.object({
  kind: z.enum(["missing", "shallow", "tool"]),
  // 반복을 세는 기준이라 짧아야 한다. 질문을 그대로 붙여넣으면 하나도 안 묶인다.
  topic: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
  /** shallow일 때 근처까지 갔던 볼트 문서 — 어디를 보강할지 바로 알 수 있다. */
  nearPaths: z.array(z.string()).max(10).optional(),
  question: z.string().trim().min(1).max(4000),
  requestId: z.string().uuid().optional(),
  operatorEmail: z.string().optional(),
});

function guard(request: NextRequest): NextResponse | null {
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
  return null;
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const parsed = gapSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("knowledge_gaps").insert({
    kind: parsed.data.kind,
    topic: parsed.data.topic,
    note: parsed.data.note ?? null,
    near_paths: parsed.data.nearPaths ?? [],
    question: parsed.data.question,
    request_id: parsed.data.requestId ?? null,
    operator_email: parsed.data.operatorEmail ?? null,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

const linkSchema = z.object({
  requestId: z.string().uuid(),
  // 초안만 가리킨다 — 본 위치 문서를 여기 넣으면 "검토 대기"로 잘못 뜬다.
  proposalPath: z.string().startsWith("제안/"),
});

/**
 * 초안이 생기면 **같은 대화**의 빈틈이 그걸 가리키게 한다.
 *
 * 제목으로는 못 잇는다 — '대학별 수시 인수인계' 빈틈과 '제안/부산대학교 수시
 * 서비스 세팅.md' 초안은 이름이 안 겹친다. 둘을 잇는 열쇠는 대화(request_id)다.
 *
 * 실제로 그 둘이 동시에 존재하는데 화면은 "문서 없음"만 보여줬다 — 초안이
 * 이미 검토를 기다리는 줄 모르면 사람이 같은 걸 또 쓴다.
 */
export async function PATCH(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const parsed = linkSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("knowledge_gaps")
    .update({ proposal_path: parsed.data.proposalPath })
    .eq("request_id", parsed.data.requestId)
    // 이미 닫은 빈틈은 건드리지 않는다 — 다시 열린 것처럼 보이면 안 된다.
    .eq("status", "open");
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
