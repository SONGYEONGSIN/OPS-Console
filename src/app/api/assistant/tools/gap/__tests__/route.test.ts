import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  inserted: null as Record<string, unknown> | null,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = {
      insert: (v: Record<string, unknown>) => {
        state.inserted = v;
        return Promise.resolve({ error: null });
      },
    };
    return { from: () => chain };
  },
}));

const { POST } = await import("../route");

const post = (body: unknown, auth = "Bearer s3cret") =>
  new Request("http://x/api/assistant/tools/gap", {
    method: "POST",
    headers: { authorization: auth },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const base = {
  kind: "missing",
  topic: "휴가 등록 절차",
  note: "볼트에 근태 관련 문서가 없다",
  question: "휴가 등록 어떻게해?",
};

describe("빈틈 기록 endpoint", () => {
  beforeEach(() => {
    state.inserted = null;
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401", async () => {
    expect((await POST(post(base, "Bearer no"))).status).toBe(401);
  });

  it("빈틈을 적재한다", async () => {
    const res = await POST(post(base));
    expect(res.status).toBe(200);
    expect(state.inserted?.kind).toBe("missing");
    expect(state.inserted?.topic).toBe("휴가 등록 절차");
  });

  it("모르는 kind는 400 — 세 갈래 구분이 이 기능의 핵심이다", async () => {
    expect((await POST(post({ ...base, kind: "없음" }))).status).toBe(400);
  });

  it("shallow면 근처 문서 경로를 함께 남긴다 — 어디를 보강할지 바로 알아야 한다", async () => {
    await POST(
      post({
        ...base,
        kind: "shallow",
        nearPaths: ["플레이북/백업 요청 그룹별 발송.md"],
      }),
    );
    expect(state.inserted?.near_paths).toEqual([
      "플레이북/백업 요청 그룹별 발송.md",
    ]);
  });

  it("topic이 비면 400 — 주제가 없으면 반복을 셀 수 없다", async () => {
    expect((await POST(post({ ...base, topic: "  " }))).status).toBe(400);
  });

  it("topic이 지나치게 길면 400 — 질문을 그대로 붙여넣으면 묶이지 않는다", async () => {
    expect((await POST(post({ ...base, topic: "가".repeat(200) }))).status).toBe(
      400,
    );
  });

  it("요청 id를 함께 남긴다 — 어떤 대화에서 나왔는지 되짚을 수 있어야 한다", async () => {
    await POST(post({ ...base, requestId: "59cb3228-8174-4196-a2ad-1c1a13713148" }));
    expect(state.inserted?.request_id).toBe(
      "59cb3228-8174-4196-a2ad-1c1a13713148",
    );
  });
});
