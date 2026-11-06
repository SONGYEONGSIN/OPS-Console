import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error?: unknown };
type Call = { method: string; args: unknown[] };

const { state } = vi.hoisted(() => ({
  state: { queue: [] as Result[], calls: [] as Call[] },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: vi.fn(),
}));
vi.mock("@/features/sms-sender/queries", () => ({
  __resetSmsSenderCache: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { __resetSmsSenderCache } from "@/features/sms-sender/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, POST } from "../request/route";

const ID = "00000000-0000-4000-8000-000000000001";
const URL = "http://localhost/api/sms-status-refresh/request";
/** 완료 보고 update 가 고친 행 — `.select("id").maybeSingle()` 결과. */
const MATCHED: Result = { data: { id: ID } };

function next(): Result {
  const r = state.queue.shift() ?? {};
  return { data: r.data ?? null, error: r.error ?? null };
}

// 체인 목 — 모든 호출을 기록하고, await·maybeSingle 마다 큐에서 결과를 하나 꺼낸다.
function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve(next()),
  };
  for (const m of ["select", "eq", "in", "not", "order", "limit", "update"]) {
    b[m] = (...args: unknown[]) => {
      state.calls.push({ method: m, args });
      return b;
    };
  }
  b.maybeSingle = () => Promise.resolve(next());
  return b;
}

function callsOf(method: string): unknown[][] {
  return state.calls.filter((c) => c.method === method).map((c) => c.args);
}

/** update 바로 뒤에 이어진 eq 들 — 조건부 update 인지 본다. */
function eqsAfterUpdate(): unknown[][] {
  const i = state.calls.findIndex((c) => c.method === "update");
  const tail = state.calls.slice(i + 1);
  const end = tail.findIndex((c) => c.method !== "eq");
  return (end === -1 ? tail : tail.slice(0, end)).map((c) => c.args);
}

function get(secret?: string) {
  return new Request(URL, {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as unknown as Parameters<typeof GET>[0];
}

function post(body: unknown, secret?: string) {
  return new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function okStep(step: string) {
  return {
    step,
    status: "ok",
    summary: "",
    counts: {},
    error: null,
    watermark: null,
  };
}

describe("/api/sms-status-refresh/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    state.queue = [];
    state.calls = [];
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => builder()),
    } as unknown as ReturnType<typeof createAdminClient>);
  });

  it("Bearer 가 틀리면 401", async () => {
    expect((await GET(get("wrong"))).status).toBe(401);
    expect((await POST(post({ id: ID, ok: true }, "wrong"))).status).toBe(401);
    expect((await GET(get())).status).toBe(401);
    expect(state.calls).toEqual([]);
  });

  it("CRON_SECRET 이 없으면 500", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(get("s3cr3t"))).status).toBe(500);
    expect((await POST(post({ id: ID, ok: true }, "s3cr3t"))).status).toBe(500);
  });

  it("pending 이 없으면 request null", async () => {
    state.queue = [{ data: [] }];
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, request: null });
    expect(callsOf("update")).toEqual([]);
  });

  it("claim 은 pending 조건부 update 이고 watermark 를 합쳐 준다", async () => {
    state.queue = [
      { data: [{ id: "req-1" }] },
      {
        data: [
          { watermarks: { mail: "2026-11-01T20:00:00Z" } },
          {
            watermarks: {
              mail: "2026-11-02T00:00:00+09:00",
              pdf: "2026-10-20T00:00:00Z",
            },
          },
          { watermarks: {} },
        ],
      },
      {
        data: {
          id: "req-1",
          requested_at: "2026-11-07T01:00:00Z",
          requested_by: "op-a",
        },
      },
    ];
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    expect(callsOf("update")).toEqual([
      [{ status: "running", claimed_at: expect.any(String) }],
    ]);
    expect(eqsAfterUpdate()).toEqual([
      ["id", "req-1"],
      ["status", "pending"],
    ]);
    expect(callsOf("not")).toContainEqual(["finished_at", "is", null]);
    expect(callsOf("limit")).toContainEqual([50]);
    expect((await res.json()).request).toEqual({
      id: "req-1",
      requested_at: "2026-11-07T01:00:00Z",
      requested_by: "op-a",
      watermarks: {
        mail: "2026-11-01T20:00:00Z",
        pdf: "2026-10-20T00:00:00Z",
      },
    });
  });

  it("다른 폴러가 먼저 가져갔으면 request null", async () => {
    state.queue = [{ data: [{ id: "req-1" }] }, { data: [] }, { data: null }];
    const res = await GET(get("s3cr3t"));
    expect((await res.json()).request).toBeNull();
  });

  it("watermark 조회가 실패하면 claim 하지 않고 500", async () => {
    state.queue = [{ data: [{ id: "req-1" }] }, { error: { message: "down" } }];
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(500);
    expect(callsOf("update")).toEqual([]);
  });

  it("본문 형식이 틀리면 400, 아무것도 안 고친다", async () => {
    const res = await POST(post({ id: "not-a-uuid", ok: "yes" }, "s3cr3t"));
    expect(res.status).toBe(400);
    expect(callsOf("update")).toEqual([]);
    expect(recordAutomationRun).not.toHaveBeenCalled();
  });

  it("모든 단계 ok → done, 결과·watermark 저장, 실행 기록 ok:true", async () => {
    const result = {
      version: 1,
      steps: [{ ...okStep("mail"), watermark: "2026-11-07T01:00:00Z" }],
      changes: ["새 번호 2건"],
    };
    state.queue = [MATCHED];
    const res = await POST(post({ id: ID, ok: true, result }, "s3cr3t"));
    expect(res.status).toBe(200);
    expect(callsOf("update")).toEqual([
      [
        {
          status: "done",
          finished_at: expect.any(String),
          message: "mail 성공",
          result,
          watermarks: { mail: "2026-11-07T01:00:00Z" },
        },
      ],
    ]);
    expect(eqsAfterUpdate()).toEqual([["id", ID]]);
    // 늦게 온 결과(40분 자동 마감 뒤)는 받는다 — 그래서 failed 도 허용.
    expect(callsOf("in")).toEqual([["status", ["running", "failed"]]]);
    expect(recordAutomationRun).toHaveBeenCalledWith("sms-status-refresh", {
      ok: true,
      message: "mail 성공",
    });
  });

  it("Moa 단계만 ok 면 실행 기록은 'Moa 수집 성공'", async () => {
    const result = { version: 1, steps: [okStep("moa")], changes: [] };
    state.queue = [MATCHED];
    await POST(post({ id: ID, ok: true, result }, "s3cr3t"));
    expect(recordAutomationRun).toHaveBeenCalledWith("sms-status-refresh", {
      ok: true,
      message: "Moa 수집 성공",
    });
  });

  it("결과 없는 실패(폴러가 죽음) → failed, 실행 기록에 tail 을 싣지 않는다", async () => {
    const tail = "exit 1 — Traceback 010-0000-0001";
    state.queue = [MATCHED];
    await POST(post({ id: ID, ok: false, message: tail }, "s3cr3t"));
    expect(callsOf("update")).toEqual([
      [
        {
          status: "failed",
          finished_at: expect.any(String),
          message: tail,
          result: null,
          watermarks: {},
        },
      ],
    ]);
    expect(recordAutomationRun).toHaveBeenCalledWith("sms-status-refresh", {
      ok: false,
      message: "회사 PC 처리 실패 — 결과 없음",
    });
  });

  it("모르는 코드여도 저장하고 판정한다", async () => {
    const result = {
      version: 1,
      changes: [],
      steps: [
        {
          step: "pdf",
          status: "failed",
          summary: "",
          counts: {},
          error: { code: "brand_new" },
          watermark: null,
        },
      ],
    };
    state.queue = [MATCHED];
    const res = await POST(post({ id: ID, ok: false, result }, "s3cr3t"));
    expect(res.status).toBe(200);
    const [[patch]] = callsOf("update") as [[Record<string, unknown>]];
    expect(patch.status).toBe("failed");
    expect(patch.result).toEqual(result);
    expect(recordAutomationRun).toHaveBeenCalledWith("sms-status-refresh", {
      ok: false,
      message: "pdf 실패(brand_new)",
    });
  });

  it("보고 때 화면 캐시를 비운다", async () => {
    state.queue = [MATCHED];
    await POST(post({ id: ID, ok: false }, "s3cr3t"));
    expect(__resetSmsSenderCache).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/internal-admin");
  });

  // 모르는 id · 중복 보고 · claim 안 된 pending 은 아무 행도 안 바뀐다 — 성공처럼 기록하지 않는다.
  it("고친 행이 없으면 404, 실행 기록·캐시 무효화 없음", async () => {
    state.queue = [{ data: null }];
    const res = await POST(post({ id: ID, ok: true }, "s3cr3t"));
    expect(res.status).toBe(404);
    expect(recordAutomationRun).not.toHaveBeenCalled();
    expect(__resetSmsSenderCache).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("GET pending 조회 오류는 500, claim 안 함", async () => {
    state.queue = [{ error: { message: "down" } }];
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(500);
    expect(callsOf("update")).toEqual([]);
  });

  it("저장이 실패하면 500, 실행 기록을 남기지 않는다", async () => {
    state.queue = [{ error: { message: "down" } }];
    const res = await POST(post({ id: ID, ok: false }, "s3cr3t"));
    expect(res.status).toBe(500);
    expect(recordAutomationRun).not.toHaveBeenCalled();
  });
});
