import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: {
    eqCalls: [] as [string, unknown][],
    result: { data: [{ id: "r1" }], error: null } as {
      data: unknown;
      error: unknown;
    },
    claimResult: {
      data: { id: "r1", service_id: 1, kind: "spec" },
      error: null,
    } as { data: unknown; error: unknown },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { GET } from "../route";

function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(state.result),
  };
  for (const m of ["select", "order", "limit", "update"]) {
    b[m] = vi.fn(() => b);
  }
  b.eq = vi.fn((col: string, val: unknown) => {
    state.eqCalls.push([col, val]);
    return b;
  });
  b.maybeSingle = vi.fn(() => Promise.resolve(state.claimResult));
  return b;
}

function get(url: string) {
  return new Request(url, {
    method: "GET",
    headers: { authorization: "Bearer s3cr3t" },
  }) as unknown as Parameters<typeof GET>[0];
}

/**
 * 집에서 명세만 처리해야 하는 상황이 있다 — 원서GEN(`generator`·`entergenerator`)이
 * 회사망 밖에서 TCP 차단이라 `analyze` 는 자택에서 못 돈다.
 *
 * 필터가 없으면 자택 폴러가 **`analyze` 요청까지 집어가 실패로 태운다.** 회사 PC가
 * 나중에 할 수 있었던 일을 없애는 것이라 조용한 손실이다.
 */
describe("analyze-request GET — kind 필터", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cr3t";
    state.eqCalls = [];
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("kind=spec 이면 명세 요청만 집어간다", async () => {
    await GET(
      get("http://localhost/api/dev-controls/analyze-request?kind=spec"),
    );
    expect(state.eqCalls).toContainEqual(["kind", "spec"]);
  });

  /** 회사 PC 폴러는 파라미터를 안 붙인다 — 그쪽 동작이 바뀌면 안 된다. */
  it("파라미터가 없으면 종류를 안 가린다 — 기존 폴러 그대로", async () => {
    await GET(get("http://localhost/api/dev-controls/analyze-request"));
    expect(state.eqCalls.map(([c]) => c)).not.toContain("kind");
  });

  /** 오타 하나로 엉뚱한 큐를 비우면 안 된다. */
  it("모르는 kind 는 거절한다", async () => {
    const res = await GET(
      get("http://localhost/api/dev-controls/analyze-request?kind=bogus"),
    );
    expect(res.status).toBe(400);
  });
});
