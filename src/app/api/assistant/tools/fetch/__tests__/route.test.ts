import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 전문 조회 도구 — `search_ops`가 200자 발췌만 줘서 내용을 옮길 수 없던 것을 푼다.
 * 권한 검사는 `search`와 같은 함수(`authorizeToolRequest`)를 쓴다.
 */

const state = {
  operator: null as Record<string, unknown> | null,
  row: null as Record<string, unknown> | null,
  lastTable: "",
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      state.lastTable = table;
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: table === "operators" ? state.operator : state.row,
            error: null,
          }),
      };
      return chain;
    },
  }),
}));

const { GET } = await import("../route");

const req = (qs: string, auth = "Bearer s3cret") =>
  new Request(`http://x/api/assistant/tools/fetch${qs}`, {
    headers: { authorization: auth },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("어시스턴트 전문 조회 도구", () => {
  beforeEach(() => {
    state.operator = {
      email: "a@x.com",
      permission: "member",
      status: "active",
    };
    state.row = null;
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401", async () => {
    const res = await GET(req("?domain=handover&id=1&as=a@x.com", "Bearer no"));
    expect(res.status).toBe(401);
  });

  it("모르는 도메인은 400 — 조용히 빈 결과를 주지 않는다", async () => {
    const res = await GET(req("?domain=nope&id=1&as=a@x.com"));
    expect(res.status).toBe(400);
  });

  it("id가 없으면 400", async () => {
    const res = await GET(req("?domain=handover&as=a@x.com"));
    expect(res.status).toBe(400);
  });

  it("탈퇴자는 403", async () => {
    state.operator = { permission: "member", status: "deleted" };
    const res = await GET(req("?domain=handover&id=1&as=a@x.com"));
    expect(res.status).toBe(403);
  });

  it("viewer는 403", async () => {
    state.operator = { permission: "viewer", status: "active" };
    const res = await GET(req("?domain=handover&id=1&as=a@x.com"));
    expect(res.status).toBe(403);
  });

  it("없는 레코드는 404", async () => {
    state.row = null;
    const res = await GET(req("?domain=handover&id=none&as=a@x.com"));
    expect(res.status).toBe(404);
  });

  it("인수인계 전문을 필드 라벨과 함께 돌려준다", async () => {
    state.row = {
      id: "h1",
      work_basic_md: "기초엑셀 세팅",
      work_etc_md: "프로시저 3종",
      services: { university_name: "부산대학교", service_name: "수시" },
    };
    const res = await GET(req("?domain=handover&id=h1&as=a@x.com"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.title).toBe("부산대학교 — 수시");
    expect(body.body).toContain("## 작업-기초");
    expect(body.body).toContain("기초엑셀 세팅");
    expect(body.body).toContain("## 작업-기타");
    expect(state.lastTable).toBe("handover_records");
  });

  it("본문이 전부 비면 그렇다고 밝힌다", async () => {
    // 빈 문자열만 돌려주면 모델이 "내용이 없다"와 "못 읽었다"를 구분 못 한다.
    state.row = { id: "h1", services: null };
    const res = await GET(req("?domain=handover&id=h1&as=a@x.com"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.empty).toBe(true);
  });
});
