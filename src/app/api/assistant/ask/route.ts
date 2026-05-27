import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { searchAllDomains, type Source } from "@/features/assistant/search";
import { askGemini, type ChatMessage } from "@/lib/ai/gemini";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const inputSchema = z.object({
  /** 신규 사용자 질문 (검색 + 컨텍스트 생성용). messages 마지막이 아니어도 우선 사용 */
  question: z.string().min(1).max(500),
  /** 이전 대화 (multi-turn). 비어있으면 single-shot과 동일 동작 */
  history: z.array(messageSchema).max(20).optional(),
});

const SYSTEM_INSTRUCTION = `당신은 OPS-Console(진학어플라이 운영부 시스템)의 어시스턴트입니다.
운영자가 사내 데이터(사고 이력, 인수인계 메모, AI TIP, 백업 요청, 대학 연락처, 서비스 정보)를
근거로 한국어로 정확하고 간결하게 답합니다.

규칙:
1. 제공된 "참고 자료"만 근거로 답하라. 추측 금지.
2. 답을 모르면 "제공된 자료에서 확인할 수 없습니다"라고 답하라.
3. 답변은 3-5문장 이내로 간결하게.
4. 사내 운영 전문 용어(원서접수/사고/백업/인수인계 등)는 그대로 사용.
5. 인용한 자료가 있으면 답변 끝에 "참고: [도메인-id]" 형식으로 표시.`;

export async function POST(req: Request): Promise<Response> {
  const me = await getCurrentOperator();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다" },
      { status: 401 },
    );
  }
  if (me.permission === "viewer") {
    return NextResponse.json(
      { ok: false, error: "권한이 없습니다" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }

  const question = parsed.data.question.trim();
  const history = parsed.data.history ?? [];
  const sources: Source[] = await searchAllDomains({ question });

  const referenceText =
    sources.length === 0
      ? "(참고 자료 없음)"
      : sources
          .map(
            (s, i) =>
              `[${i + 1}] [${s.domain}-${s.id.slice(0, 8)}] ${s.title}\n${s.snippet}`,
          )
          .join("\n\n");

  // 마지막 user 메시지에 question + 참고 자료 컨텍스트를 합쳐 Gemini에 전달.
  // 이전 history는 그대로 multi-turn context로 유지.
  const userContent = `## 사용자 질문\n${question}\n\n## 참고 자료\n${referenceText}`;
  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: userContent },
  ];

  const ai = await askGemini({
    systemInstruction: SYSTEM_INSTRUCTION,
    messages,
  });
  if (!ai.ok) {
    return NextResponse.json(
      { ok: false, error: ai.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    answer: ai.text,
    sources,
    warning:
      sources.length === 0
        ? "검색 결과 없음 — 답변이 부정확할 수 있습니다"
        : undefined,
  });
}
