import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: { email: "me@x.com", permission: "member" } as
    | { email: string; permission: string }
    | null,
  inserted: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (v: Record<string, unknown>) => {
        state.inserted = v;
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: state.error ? null : { id: "req-1" },
                error: state.error,
              }),
          }),
        };
      },
    }),
  }),
}));

const { requestFileDraft, requestTextDraft } = await import(
  "../file-draft-actions",
);

const LINK = "https://tenant.sharepoint.com/sites/운영부/보고서.docx";

describe("파일로 초안 요청", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.inserted = null;
    state.error = null;
  });

  it("요청 id를 돌려준다 — 화면이 진행을 지켜보려면 이게 있어야 한다", async () => {
    const r = await requestFileDraft(LINK, "");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toBe("req-1");
    // 되묻기에 답하려면 앞서 무엇을 물었는지가 history 에 실려야 한다.
    expect(r.question).toContain(LINK);
  });

  it("어시스턴트 큐에 넣는다 — 빈틈 초안과 같은 길이다", async () => {
    const r = await requestFileDraft(LINK, "");
    expect(r.ok).toBe(true);
    expect(String(state.inserted?.question)).toContain(LINK);
    expect(state.inserted?.operator_email).toBe("me@x.com");
  });

  it("사내 링크가 아니면 거절한다 — 큐에 넣기 전에 막는다", async () => {
    const r = await requestFileDraft("https://evil.example.com/a.docx", "");
    expect(r.ok).toBe(false);
    expect(state.inserted).toBeNull();
  });

  it("링크가 비면 거절한다", async () => {
    expect((await requestFileDraft("  ", "")).ok).toBe(false);
  });

  it("viewer는 못 한다 — 볼트에 글이 생기는 일이다", async () => {
    state.me = { email: "v@x.com", permission: "viewer" };
    expect((await requestFileDraft(LINK, "")).ok).toBe(false);
  });

  it("로그인 안 했으면 못 한다", async () => {
    state.me = null;
    expect((await requestFileDraft(LINK, "")).ok).toBe(false);
  });

  it("사람이 덧붙인 설명을 함께 보낸다 — 무엇을 뽑을지는 사람이 안다", async () => {
    await requestFileDraft(LINK, "수수료 정산 규칙만 정리해줘");
    expect(String(state.inserted?.question)).toContain("수수료 정산 규칙만");
  });

  it("지어내지 말라고 못박는다 — 파일에 없는 걸 쓰면 지식이 오염된다", async () => {
    await requestFileDraft(LINK, "");
    expect(String(state.inserted?.question)).toMatch(/지어내/);
  });

  it("제안/ 을 거치라고 적는다 — 본 위치에 바로 쓰면 검토가 사라진다", async () => {
    await requestFileDraft(LINK, "");
    expect(String(state.inserted?.question)).toContain("제안/");
  });
});

/**
 * 파일이 아니라 **붙여넣은 본문**으로 초안 만들기.
 *
 * 링크도 파일도 없는 지식이 있다 — 메일 본문, 회의에서 오간 말, 다른 시스템의
 * 화면. `read_file` 을 거치지 않고 본문이 그대로 질문에 들어간다.
 */
describe("직접 입력으로 초안 요청", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.inserted = null;
    state.error = null;
  });

  it("본문을 그대로 싣는다 — read_file 을 거치지 않는다", async () => {
    const r = await requestTextDraft("수수료는 매월 10일에 정산한다", "");
    expect(r.ok).toBe(true);
    const q = String(state.inserted?.question);
    expect(q).toContain("수수료는 매월 10일에 정산한다");
    expect(q).not.toContain("read_file");
  });

  it("붙여넣은 내용만 쓰라고 못박는다 — 지어내면 지식이 아니다", async () => {
    await requestTextDraft("아무 말", "");
    expect(String(state.inserted?.question)).toContain("지어내지 마세요");
  });

  it("무엇을 정리할지도 함께 싣는다", async () => {
    await requestTextDraft("본문", "수수료 규칙만");
    expect(String(state.inserted?.question)).toContain("수수료 규칙만");
  });

  it("빈 본문은 큐에 넣지 않는다", async () => {
    const r = await requestTextDraft("   ", "");
    expect(r).toEqual({ ok: false, error: "정리할 내용을 붙여넣으세요" });
    expect(state.inserted).toBeNull();
  });

  it("읽기 전용 권한은 거절한다", async () => {
    state.me = { email: "v@x.com", permission: "viewer" };
    const r = await requestTextDraft("본문", "");
    expect(r.ok).toBe(false);
  });

  it("같은 화면에서 온 것으로 남긴다 — 진행을 이어받으려면 표식이 같아야 한다", async () => {
    await requestTextDraft("본문", "");
    expect(state.inserted?.page_context).toBe("지식망 — 파일로 초안");
  });
});
