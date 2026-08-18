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
