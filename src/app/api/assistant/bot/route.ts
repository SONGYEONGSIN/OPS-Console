import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Teams 봇 창구 — 사내 채팅방의 질문을 **웹 어시스턴트와 같은 큐**에 넣는다.
 *
 * 봇에 도구를 따로 붙이지 않는 이유: 볼트는 회사 PC의 파일이라 봇이 어디에 있든
 * 직접 읽을 수 없다. 도구만 빌려주면 같은 질문에 웹과 다른 답을 내는 **두 번째 뇌**가
 * 생기는데, 2026-08-19 에 빠른 답변(Gemini)을 걷어낸 이유가 정확히 그것이었다.
 * 같은 큐에 넣으면 프롬프트·도구·볼트·빈틈 수집이 전부 그대로 따라온다.
 *
 * 세션이 없으므로 CRON_SECRET 으로 봇 서버를 인증하고, **요청자는 운영자 명부에
 * 있는 사람만** 받는다 — 비밀키 하나로 아무 이름이나 적어 넣을 수 없게 한다.
 */

const askSchema = z.object({
  question: z.string().trim().min(1).max(4000),
  /** Teams 사용자의 UPN. operators.email 과 같아야 한다. */
  operatorEmail: z.string().trim().email(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20_000),
      }),
    )
    .max(50)
    .optional(),
});

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/** 운영자 명부에 있는 사람인가. */
async function isOperator(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("operators")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = askSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { question, operatorEmail, history } = parsed.data;
  if (!(await isOperator(operatorEmail))) {
    return NextResponse.json(
      { ok: false, error: "운영자 명부에 없는 사용자입니다" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assistant_requests")
    .insert({
      operator_email: operatorEmail,
      question,
      // 웹 이력에 섞여 보이므로 어디서 온 질문인지 남긴다. 프롬프트에도 한 줄로 들어가
      // 모델이 "채팅방에서 여럿이 보는 답"임을 알고 쓴다.
      page_context: "Teams 채팅",
      history: history ?? [],
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "적재 실패" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const operatorEmail = searchParams.get("operatorEmail");
  if (!id || !operatorEmail) {
    return NextResponse.json(
      { ok: false, error: "id·operatorEmail이 필요합니다" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  // 이메일로 함께 거른다 — id 추측만으로 남의 질문이 새면 안 된다(웹 창구와 같은 규칙).
  const { data } = await admin
    .from("assistant_requests")
    .select("status, answer, sources, message")
    .eq("id", id)
    .eq("operator_email", operatorEmail)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const row = data as {
    status: string;
    answer: string | null;
    sources: string[] | null;
    message: string | null;
  };
  return NextResponse.json({
    ok: true,
    status: row.status,
    answer: row.answer,
    sources: row.sources ?? [],
    message: row.message,
  });
}
