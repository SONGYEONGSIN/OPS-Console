import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: null as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import {
  getTeamBriefingByShareToken,
  getPendingBriefingDraft,
  getPublishedCelebrationKeys,
} from "../queries";

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  return b;
}

describe("getTeamBriefingByShareToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { data: null, error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("빈 토큰 → null (조회 없이)", async () => {
    expect(await getTeamBriefingByShareToken("")).toBeNull();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("토큰 일치 → issueNo/briefingDate/payload 반환", async () => {
    state.result = {
      data: {
        issue_no: 12,
        briefing_date: "2026-07-17",
        payload: { dateLabel: "2026-07-17 (금)" },
      },
      error: null,
    };
    const r = await getTeamBriefingByShareToken("tok123");
    expect(r).not.toBeNull();
    expect(r!.issueNo).toBe(12);
    expect(r!.briefingDate).toBe("2026-07-17");
    expect(r!.payload.dateLabel).toBe("2026-07-17 (금)");
  });

  it("미존재/에러 → null", async () => {
    state.result = { data: null, error: { message: "boom" } };
    expect(await getTeamBriefingByShareToken("nope")).toBeNull();
  });

  it("status를 함께 반환한다 (초안 배너 판별용)", async () => {
    state.result = {
      data: {
        issue_no: 2,
        briefing_date: "2026-07-31",
        payload: { dateLabel: "2026-07-31 (금)" },
        status: "draft",
      },
      error: null,
    };
    const r = await getTeamBriefingByShareToken("tok-draft");
    expect(r!.status).toBe("draft");
  });

  it("status 누락(구 행)이면 published로 본다", async () => {
    state.result = {
      data: {
        issue_no: 1,
        briefing_date: "2026-07-24",
        payload: { dateLabel: "2026-07-24 (금)" },
      },
      error: null,
    };
    const r = await getTeamBriefingByShareToken("tok-old");
    expect(r!.status).toBe("published");
  });
});

describe("getPendingBriefingDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { data: null, error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
    process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com";
  });

  it("초안 없으면 null", async () => {
    expect(await getPendingBriefingDraft()).toBeNull();
  });

  it("초안이 있으면 id/호수/미리보기 URL 반환", async () => {
    state.result = {
      data: {
        id: "d1",
        issue_no: 2,
        share_token: "tok2",
        created_at: "2026-07-31T01:00:00Z",
      },
      error: null,
    };
    const r = await getPendingBriefingDraft();
    expect(r).not.toBeNull();
    expect(r!.id).toBe("d1");
    expect(r!.issueNo).toBe(2);
    expect(r!.url).toBe("https://ops.example.com/r/briefing/tok2");
  });
});

describe("getPublishedCelebrationKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("발행분 payload의 근속·생일을 키 집합으로 모은다", async () => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) b[m] = vi.fn(() => b);
    b.then = (resolve: (v: unknown) => void) =>
      resolve({
        data: [
          {
            payload: {
              milestones: [{ name: "김지영", dateYmd: "2026-07-27" }],
              birthdays: [{ name: "박시현", dateYmd: "2026-08-03" }],
            },
          },
          { payload: { milestones: [{ name: "전지은", dateYmd: "2026-07-14" }] } },
        ],
        error: null,
      });
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => b) });

    const keys = await getPublishedCelebrationKeys();
    expect(keys.has("ms:김지영:2026-07-27")).toBe(true);
    expect(keys.has("bd:박시현:2026-08-03")).toBe(true);
    expect(keys.has("ms:전지은:2026-07-14")).toBe(true);
    expect(keys.size).toBe(3);
  });

  it("payload에 기념일이 없어도 안전하게 빈 집합", async () => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) b[m] = vi.fn(() => b);
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ payload: {} }, { payload: null }], error: null });
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => b) });

    expect((await getPublishedCelebrationKeys()).size).toBe(0);
  });
});
