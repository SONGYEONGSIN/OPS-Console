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
