import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  inserted: null as Record<string, unknown> | null,
  updated: null as Record<string, unknown> | null,
  filters: [] as [string, unknown][],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = {
      insert: (v: Record<string, unknown>) => {
        state.inserted = v;
        return Promise.resolve({ error: null });
      },
      update: (v: Record<string, unknown>) => {
        state.updated = v;
        return chain;
      },
      eq: (c: string, val: unknown) => {
        state.filters.push([c, val]);
        return chain;
      },
      then: (r: (v: { error: null }) => unknown) => r({ error: null }),
    };
    return { from: () => chain };
  },
}));

const { POST, PATCH } = await import("../route");

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
    state.updated = null;
    state.filters = [];
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

const patch = (body: unknown, auth = "Bearer s3cret") =>
  new Request("http://x/api/assistant/tools/gap", {
    method: "PATCH",
    headers: { authorization: auth },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/**
 * 초안이 생기면 같은 대화의 빈틈이 그걸 가리켜야 한다.
 * 제목으로는 못 잇는다 — '대학별 수시 인수인계' 빈틈과
 * '제안/부산대학교 수시 서비스 세팅.md' 초안은 이름이 안 겹친다.
 */
describe("빈틈 ↔ 초안 연결", () => {
  beforeEach(() => {
    state.inserted = null;
    state.updated = null;
    state.filters = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401", async () => {
    const res = await PATCH(
      patch(
        { requestId: "59cb3228-8174-4196-a2ad-1c1a13713148", proposalPath: "제안/x.md" },
        "Bearer no",
      ),
    );
    expect(res.status).toBe(401);
  });

  it("같은 대화의 빈틈에 초안 경로를 적는다", async () => {
    const res = await PATCH(
      patch({
        requestId: "59cb3228-8174-4196-a2ad-1c1a13713148",
        proposalPath: "제안/부산대학교 수시 서비스 세팅.md",
      }),
    );
    expect(res.status).toBe(200);
    expect(state.updated?.proposal_path).toBe(
      "제안/부산대학교 수시 서비스 세팅.md",
    );
    expect(state.filters).toContainEqual([
      "request_id",
      "59cb3228-8174-4196-a2ad-1c1a13713148",
    ]);
  });

  it("이미 닫힌 빈틈은 건드리지 않는다 — 다시 열린 것처럼 보이면 안 된다", async () => {
    await PATCH(
      patch({
        requestId: "59cb3228-8174-4196-a2ad-1c1a13713148",
        proposalPath: "제안/x.md",
      }),
    );
    expect(state.filters).toContainEqual(["status", "open"]);
  });

  it("requestId가 없으면 400", async () => {
    expect((await PATCH(patch({ proposalPath: "제안/x.md" }))).status).toBe(400);
  });

  it("제안 폴더 밖 경로는 400 — 초안만 가리킨다", async () => {
    const res = await PATCH(
      patch({
        requestId: "59cb3228-8174-4196-a2ad-1c1a13713148",
        proposalPath: "규칙/x.md",
      }),
    );
    expect(res.status).toBe(400);
  });
});
