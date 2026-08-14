import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: vi.fn(),
}));
vi.mock("@/features/assistant/search", () => ({
  searchAllDomains: vi.fn(),
}));
vi.mock("@/lib/ai/gemini", () => ({
  askGemini: vi.fn(),
}));

const { getCurrentOperator } = await import("@/features/auth/queries");
const { searchAllDomains } = await import("@/features/assistant/search");
const { askGemini } = await import("@/lib/ai/gemini");

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/assistant/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/assistant/ask", () => {
  beforeEach(() => {
    vi.mocked(getCurrentOperator).mockReset();
    vi.mocked(searchAllDomains).mockReset();
    vi.mocked(askGemini).mockReset();
  });

  it("미인증 → 401", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(postReq({ question: "x" }));
    expect(res.status).toBe(401);
  });

  it("question 누락 → 400", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "a@x.com",
      displayName: "A",
      permission: "member",
    } as never);
    const { POST } = await import("../route");
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("viewer 권한 → 403", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "v@x.com",
      displayName: "V",
      permission: "viewer",
    } as never);
    const { POST } = await import("../route");
    const res = await POST(postReq({ question: "test" }));
    expect(res.status).toBe(403);
  });

  it("정상 흐름 — 검색 + Gemini 호출 + answer/sources 반환", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "M",
      permission: "member",
    } as never);
    vi.mocked(searchAllDomains).mockResolvedValue([
      {
        domain: "incident",
        id: "inc-1",
        title: "테스트 사고",
        snippet: "...",
        deepLink: "/dashboard/incidents",
      },
    ]);
    vi.mocked(askGemini).mockResolvedValue({
      ok: true,
      text: "답변 내용",
    });
    const { POST } = await import("../route");
    const res = await POST(postReq({ question: "외국인 전형 오류" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toBe("답변 내용");
    expect(json.sources).toHaveLength(1);
    expect(json.sources[0].domain).toBe("incident");
  });

  it("pageContext를 주면 지금 보고 있는 화면을 프롬프트에 싣는다", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "M",
      permission: "member",
    } as never);
    vi.mocked(searchAllDomains).mockResolvedValue([]);
    vi.mocked(askGemini).mockResolvedValue({ ok: true, text: "답변" });
    const { POST } = await import("../route");
    await POST(
      postReq({
        question: "이 화면 뭐하는 곳이야",
        pageContext: {
          path: "/dashboard/incidents",
          label: "사고 보고",
          pattern: "list",
        },
      }),
    );
    const sent = vi.mocked(askGemini).mock.calls[0][0];
    const messages = sent.messages ?? [];
    const userContent = messages[messages.length - 1]?.content ?? "";
    expect(userContent).toContain("사고 보고");
    expect(userContent).toContain("/dashboard/incidents");
  });

  it("pageContext가 없으면 화면 섹션을 넣지 않는다", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "M",
      permission: "member",
    } as never);
    vi.mocked(searchAllDomains).mockResolvedValue([]);
    vi.mocked(askGemini).mockResolvedValue({ ok: true, text: "답변" });
    const { POST } = await import("../route");
    await POST(postReq({ question: "미수채권 얼마" }));
    const sent = vi.mocked(askGemini).mock.calls[0][0];
    const messages = sent.messages ?? [];
    const userContent = messages[messages.length - 1]?.content ?? "";
    expect(userContent).not.toContain("지금 보고 있는 화면");
  });

  it("pageContext 길이 초과 → 400 (클라이언트 값이라 프롬프트 주입 통로가 된다)", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "M",
      permission: "member",
    } as never);
    const { POST } = await import("../route");
    const res = await POST(
      postReq({
        question: "x",
        pageContext: {
          path: "/dashboard/incidents",
          label: "라".repeat(200),
          pattern: "list",
        },
      }),
    );
    expect(res.status).toBe(400);
    expect(vi.mocked(askGemini)).not.toHaveBeenCalled();
  });

  it("Gemini 호출 실패 → 500 + 에러 메시지", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "M",
      permission: "member",
    } as never);
    vi.mocked(searchAllDomains).mockResolvedValue([]);
    vi.mocked(askGemini).mockResolvedValue({
      ok: false,
      error: "rate limit",
    });
    const { POST } = await import("../route");
    const res = await POST(postReq({ question: "x" }));
    expect(res.status).toBe(500);
  });

  it("검색 결과 0건이어도 Gemini 호출 → warning 포함", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "M",
      permission: "member",
    } as never);
    vi.mocked(searchAllDomains).mockResolvedValue([]);
    vi.mocked(askGemini).mockResolvedValue({ ok: true, text: "잘 모르겠습니다" });
    const { POST } = await import("../route");
    const res = await POST(postReq({ question: "asdf" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sources).toEqual([]);
    expect(json.warning).toBeTruthy();
  });
});
