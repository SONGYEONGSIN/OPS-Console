import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCreateAdminClient,
  mockRecord,
  mockJudgeInput,
  mockPersist,
  state,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockRecord: vi.fn(),
  mockJudgeInput: vi.fn(),
  mockPersist: vi.fn(),
  state: {
    /** select 체인이 돌려줄 목록. */
    rows: [] as unknown[],
    /** 원자적 claim / 단건 조회가 돌려줄 행. */
    single: null as unknown,
    /** **두 에러를 갈라 둔다** — 하나로 두면 select 가드를 지워도 claim 가드가
     *  같은 500 을 내며 테스트가 초록이다(실제로 그랬다). */
    selectError: null as { message: string } | null,
    singleError: null as { message: string } | null,
    calls: [] as { verb: string; args: unknown[] }[],
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: mockRecord,
}));
vi.mock("@/features/assignments/proposal/judge-input", () => ({
  loadJudgeInput: mockJudgeInput,
}));
vi.mock("@/features/assignments/proposal/persist", () => ({
  persistProposalBatch: mockPersist,
}));

import { GET, POST } from "../route";

/**
 * 회사 PC 폴러 창구(§6.4) — `Authorization: Bearer ${CRON_SECRET}`.
 *
 *   GET  → 가장 오래된 pending 1건을 **원자적 claim** + **프롬프트**.
 *   POST → 모델 응답 원문 회신 → **여기서 검산하고 적재**한다.
 *
 * **폴러는 에이전트만 돌린다.** 게이트를 회사 PC 로 내보내면 검산이 두 곳에 생기고,
 * 그 PC 의 코드가 낡은 채로 통과시킨 배치를 아무도 못 알아챈다.
 *
 * **실패 보고가 유일한 창구다.** 폴러가 죽어도 화면엔 큐 적재의 '성공' 만 떠 있던
 * 사고가 있었다(2026-08-19). 그래서 모든 실패 갈래가 `recordAutomationRun` 을 탄다.
 */
function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "update", "in"]) {
    b[m] = (...args: unknown[]) => {
      state.calls.push({ verb: m, args });
      return b;
    };
  }
  b.then = (resolve: (v: unknown) => void) =>
    resolve({ data: state.rows, error: state.selectError });
  b.maybeSingle = () =>
    Promise.resolve({ data: state.single, error: state.singleError });
  return b;
}

const SECRET = "s3cret";

const req = (opts: { secret?: string; body?: unknown; method: string }) =>
  new Request("http://localhost/api/assignments/propose-request", {
    method: opts.method,
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as Parameters<typeof GET>[0];

const get = (secret?: string) => req({ method: "GET", secret });
const post = (secret: string | undefined, body: unknown) =>
  req({ method: "POST", secret, body });

const ANNUAL_ROW = {
  id: "r1",
  requested_by: "automation",
  academic_year: 2027,
  kind: "annual",
  university_name: null,
  work_kind: null,
};

const JUDGE_INPUT = {
  prompt: "표와 지시문",
  promptHash: "deadbeefdeadbeef",
  candidates: [{ university_name: "가대", work_kind: "원서접수" }],
  groups: [],
  gateContext: {
    operators: [],
    ledger: [],
    serviceCounts: {},
    spans: [],
    windows: {
      week: ["2026-09-14", "2026-09-20"],
      month: ["2026-09-01", "2026-09-30"],
      year: ["2026-03-01", "2027-02-28"],
    },
  },
};

const updateArgs = () =>
  state.calls.filter((c) => c.verb === "update").map((c) => c.args[0]);

function reset() {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRET);
  state.rows = [];
  state.single = null;
  state.selectError = null;
  state.singleError = null;
  state.calls = [];
  mockCreateAdminClient.mockReturnValue({ from: () => builder() });
  mockJudgeInput.mockResolvedValue(JUDGE_INPUT);
  mockPersist.mockResolvedValue({
    ok: true,
    batchId: "b1",
    proposals: 2,
    rejected: 1,
    summary: "이동 1건 · 탈락 1건(G6 1)",
  });
}

describe("GET — claim + 프롬프트", () => {
  beforeEach(reset);

  it("비밀키가 없으면 500 — 설정 누락을 인증 실패로 숨기지 않는다", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(get(SECRET))).status).toBe(500);
  });

  it("비밀키가 틀리면 401", async () => {
    expect((await GET(get("wrong"))).status).toBe(401);
  });

  it("pending 이 없으면 request: null", async () => {
    expect(await (await GET(get(SECRET))).json()).toEqual({
      ok: true,
      request: null,
    });
  });

  it("가장 오래된 pending 을 고른다", async () => {
    state.rows = [{ id: "r1" }];
    state.single = ANNUAL_ROW;

    await GET(get(SECRET));

    expect(state.calls).toEqual(
      expect.arrayContaining([
        { verb: "eq", args: ["status", "pending"] },
        { verb: "order", args: ["requested_at", { ascending: true }] },
      ]),
    );
  });

  it("claim 은 원자적이다 — 아직 pending 일 때만 running 으로 바꾼다", async () => {
    state.rows = [{ id: "r1" }];
    state.single = ANNUAL_ROW;

    await GET(get(SECRET));

    expect(updateArgs()[0]).toMatchObject({ status: "running" });
    expect(state.calls).toEqual(
      expect.arrayContaining([{ verb: "eq", args: ["id", "r1"] }]),
    );
    expect(
      state.calls.filter(
        (c) =>
          c.verb === "eq" && c.args[0] === "status" && c.args[1] === "pending",
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("경합으로 남이 가져갔으면 빈손이다", async () => {
    state.rows = [{ id: "r1" }];
    state.single = null;

    expect(await (await GET(get(SECRET))).json()).toEqual({
      ok: true,
      request: null,
    });
    expect(mockJudgeInput).not.toHaveBeenCalled();
  });

  it("프롬프트를 함께 준다 — 폴러는 조립하지 않는다", async () => {
    state.rows = [{ id: "r1" }];
    state.single = ANNUAL_ROW;

    const body = await (await GET(get(SECRET))).json();

    expect(body).toMatchObject({
      prompt: "표와 지시문",
      promptHash: "deadbeefdeadbeef",
    });
    expect(body.request).toMatchObject({ kind: "annual", academic_year: 2027 });
  });

  it("단건이면 그 대상으로 프롬프트를 만든다", async () => {
    state.rows = [{ id: "r1" }];
    state.single = {
      ...ANNUAL_ROW,
      kind: "single",
      university_name: "가대",
      work_kind: "원서접수",
    };

    await GET(get(SECRET));

    expect(mockJudgeInput).toHaveBeenCalledWith(2027, expect.any(Date), {
      university_name: "가대",
      work_kind: "원서접수",
    });
  });

  it("입력 조립이 실패하면 그 자리에서 마감한다 — running 으로 두면 큐가 잠긴다", async () => {
    state.rows = [{ id: "r1" }];
    state.single = ANNUAL_ROW;
    mockJudgeInput.mockRejectedValue(new Error("명부 조회 실패"));

    const res = await GET(get(SECRET));

    expect(res.status).toBe(500);
    expect(updateArgs()).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "failed" })]),
    );
    expect(mockRecord).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ ok: false }),
    );
  });

  it("pending 조회가 실패하면 500 — 조용한 빈손은 '할 일이 없다' 로 읽힌다", async () => {
    state.selectError = { message: "boom" };

    const res = await GET(get(SECRET));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/boom/);
  });

  it("claim 이 실패하면 500", async () => {
    state.rows = [{ id: "r1" }];
    state.singleError = { message: "claim 터짐" };

    expect((await GET(get(SECRET))).status).toBe(500);
  });
});

describe("POST — 응답 검산", () => {
  beforeEach(reset);

  it("비밀키가 틀리면 401", async () => {
    expect((await POST(post("wrong", { id: "r1", ok: true }))).status).toBe(
      401,
    );
  });

  it("id 가 없으면 400", async () => {
    expect((await POST(post(SECRET, { ok: true }))).status).toBe(400);
  });

  it("폴러가 실패를 알리면 failed 로 마감하고 이력에 남긴다", async () => {
    await POST(
      post(SECRET, { id: "r1", ok: false, message: "에이전트 타임아웃" }),
    );

    expect(updateArgs()[0]).toMatchObject({
      status: "failed",
      message: "에이전트 타임아웃",
    });
    expect(mockRecord).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ ok: false }),
    );
  });

  it("검산은 지금 원장을 다시 읽는다 — 그 사이 사람이 고쳤을 수 있다", async () => {
    state.single = ANNUAL_ROW;

    await POST(
      post(SECRET, {
        id: "r1",
        ok: true,
        verdictRaw: '{"moves":[]}',
        model: "claude-opus-5",
        promptHash: "deadbeefdeadbeef",
      }),
    );

    expect(mockJudgeInput).toHaveBeenCalledWith(
      2027,
      expect.any(Date),
      undefined,
    );
  });

  it("통과하면 배치를 적재하고 done 으로 마감한다", async () => {
    state.single = ANNUAL_ROW;

    const res = await POST(
      post(SECRET, {
        id: "r1",
        ok: true,
        verdictRaw: '{"moves":[]}',
        model: "claude-opus-5",
        promptHash: "deadbeefdeadbeef",
      }),
    );

    expect(await res.json()).toMatchObject({ ok: true, batchId: "b1" });
    expect(updateArgs()[0]).toMatchObject({ status: "done", batch_id: "b1" });
    // 성공은 자동화 이력에 안 남긴다 — 배치가 이미 숫자를 남겼다.
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("무엇으로 물었는지 배치에 넘긴다 — basis 가 그걸 얼린다", async () => {
    state.single = ANNUAL_ROW;

    await POST(
      post(SECRET, {
        id: "r1",
        ok: true,
        verdictRaw: '{"moves":[]}',
        model: "claude-opus-5",
        promptHash: "deadbeefdeadbeef",
      }),
    );

    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-5",
        promptHash: "deadbeefdeadbeef",
        verdictRaw: '{"moves":[]}',
        academicYear: 2027,
        kind: "annual",
        requestedBy: "automation",
      }),
    );
  });

  it("응답을 못 읽으면 적재하지 않고 이유를 남긴다", async () => {
    state.single = ANNUAL_ROW;

    const res = await POST(
      post(SECRET, {
        id: "r1",
        ok: true,
        verdictRaw: "미안하지만 못 하겠습니다",
      }),
    );

    expect(mockPersist).not.toHaveBeenCalled();
    expect((await res.json()).ok).toBe(false);
    expect(updateArgs()[0]).toMatchObject({ status: "failed" });
    expect(
      String(
        updateArgs()[0] && (updateArgs()[0] as { message: string }).message,
      ),
    ).toMatch(/JSON/);
  });

  it("적재가 실패하면 failed 로 마감하고 이유를 그대로 옮긴다", async () => {
    state.single = ANNUAL_ROW;
    mockPersist.mockResolvedValue({
      ok: false,
      error: "배치(b9)는 만들어졌지만 제안 적재가 실패했습니다: 23503",
    });

    const res = await POST(
      post(SECRET, { id: "r1", ok: true, verdictRaw: '{"moves":[]}' }),
    );

    expect(res.status).toBe(500);
    expect(
      String(
        updateArgs()[0] && (updateArgs()[0] as { message: string }).message,
      ),
    ).toMatch(/b9/);
  });

  it("요청을 못 찾으면 404 — 남의 id 로 마감하지 않는다", async () => {
    state.single = null;

    expect(
      (await POST(post(SECRET, { id: "없는id", ok: true, verdictRaw: "{}" })))
        .status,
    ).toBe(404);
  });

  it("긴 메시지는 자른다 — 이력 칸을 터뜨리지 않는다", async () => {
    await POST(
      post(SECRET, { id: "r1", ok: false, message: "가".repeat(900) }),
    );

    expect(
      String((updateArgs()[0] as { message: string }).message).length,
    ).toBeLessThanOrEqual(500);
  });
});
