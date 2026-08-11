import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockInsert, mockRecordRun } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockRecordRun: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: mockSelect,
      insert: mockInsert,
    }),
  }),
}));

vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: mockRecordRun,
}));

import { GET, POST } from "../route";

const SECRET = "test-secret";

function req(body: unknown, auth = `Bearer ${SECRET}`) {
  return new Request("http://localhost/api/ai-tips/candidates", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  mockSelect.mockResolvedValue({ data: [], error: null });
  mockInsert.mockResolvedValue({ data: [], error: null });
});

describe("POST /api/ai-tips/candidates — 인증", () => {
  it("secret이 틀리면 401", async () => {
    const res = await POST(req({ candidates: [] }, "Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("본문이 스키마에 안 맞으면 400", async () => {
    const res = await POST(req({ candidates: [{ repo_url: "u" }] }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ai-tips/candidates — 적재", () => {
  it("후보를 insert하고 건수를 돌려준다", async () => {
    const res = await POST(
      req({
        candidates: [
          {
            repo_full_name: "a/one",
            repo_url: "https://github.com/a/one",
            stars: 300,
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ ok: true, inserted: 1 });
  });

  it("수집 0건도 성공이다 — 그 주에 새 리포가 없을 수 있다", async () => {
    const res = await POST(req({ candidates: [] }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, inserted: 0 });
  });

  it("실행 이력을 남긴다 — 일일 보고가 미실행을 잡으려면 필요하다", async () => {
    await POST(req({ candidates: [] }));
    expect(mockRecordRun).toHaveBeenCalledWith(
      "ai-tips-collect",
      expect.objectContaining({ ok: true }),
    );
  });
});

describe("GET /api/ai-tips/candidates", () => {
  it("이미 본 repo 이름을 돌려준다 — status와 무관하다", async () => {
    mockSelect.mockResolvedValue({
      data: [{ repo_full_name: "a/one" }, { repo_full_name: "b/two" }],
      error: null,
    });
    const res = await GET(
      new Request("http://localhost/api/ai-tips/candidates", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      seen: ["a/one", "b/two"],
    });
  });
});
