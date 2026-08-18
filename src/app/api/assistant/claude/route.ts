import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 어시스턴트 Claude 모드 — 웹 쪽 창구.
 *   POST → 질문을 큐에 pending으로 적재하고 id를 돌려준다(즉답 없음).
 *   GET ?id= → 그 요청의 상태·답·근거를 돌려준다. 클라이언트가 폴링한다.
 *
 * 실행은 회사 PC 폴러가 한다 — Claude 구독(OAuth)은 Vercel에서 쓸 수 없다.
 * 쓰기는 service_role로 하되, **조회는 반드시 본인 이메일로 함께 걸러** 남의 질문이
 * id 추측만으로 새지 않게 한다(테이블 RLS와 이중).
 */

const askSchema = z.object({
  question: z.string().trim().min(1).max(4000),
  pageContext: z.string().max(200).nullish(),
  /**
   * 같은 창에서 앞서 주고받은 것. 없으면 매 요청이 백지에서 시작해
   * "엔티티로 해주세요" 같은 이어 말하기가 통하지 않는다.
   * 프롬프트에 몇 턴을 실을지는 서버가 자른다(claude-prompt.ts).
   */
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

export async function POST(request: NextRequest) {
  const me = await getCurrentOperator();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다" },
      { status: 401 },
    );
  }

  const parsed = askSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assistant_requests")
    .insert({
      operator_email: me.email,
      question: parsed.data.question,
      page_context: parsed.data.pageContext ?? null,
      history: parsed.data.history ?? [],
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function GET(request: NextRequest) {
  const me = await getCurrentOperator();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다" },
      { status: 401 },
    );
  }

  const id = request.nextUrl?.searchParams.get("id") ?? new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assistant_requests")
    .select("id, status, answer, sources, message")
    .eq("id", id)
    .eq("operator_email", me.email)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "요청을 찾을 수 없습니다" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, ...data });
}
