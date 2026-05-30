import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// cron 호출은 세션이 없어 RLS server client로는 automation_settings를 못 읽는다(anon → 0건).
// → getJobEnabled는 admin client(service_role, RLS 우회)로 읽어야 cron이 ON을 인식한다.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: async () => ({ data: [] }) }), // RLS 차단 시뮬레이션
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { computeCooldownRemaining, getJobEnabled } from "../queries";
import { createAdminClient } from "@/lib/supabase/admin";

const mockAdmin = createAdminClient as unknown as Mock;

const now = new Date("2026-05-21T12:00:00Z");

describe("getJobEnabled (cron enabled 게이트)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdmin.mockReturnValue({
      from: () => ({
        select: async () => ({
          data: [{ job_id: "receivables-mail-operator", enabled: true }],
        }),
      }),
    });
  });

  it("enabled=true 잡은 admin client로 읽어 true (cron 세션 없이도 인식)", async () => {
    expect(await getJobEnabled("receivables-mail-operator")).toBe(true);
    expect(mockAdmin).toHaveBeenCalled();
  });

  it("settings에 없는 잡은 false (기본 OFF)", async () => {
    expect(await getJobEnabled("receivables-deposit-match")).toBe(false);
  });
});

describe("computeCooldownRemaining", () => {
  it("lastRunAt 없으면 0", () => {
    expect(computeCooldownRemaining(null, 60, now)).toBe(0);
  });

  it("쿨다운 경과 시 0", () => {
    const last = new Date("2026-05-21T10:00:00Z").toISOString(); // 120분 전
    expect(computeCooldownRemaining(last, 60, now)).toBe(0);
  });

  it("쿨다운 진행 중이면 올림한 잔여 분", () => {
    const last = new Date("2026-05-21T11:30:30Z").toISOString(); // 29분 30초 전
    // 60 - 29.5 = 30.5분 남음 → ceil = 31
    expect(computeCooldownRemaining(last, 60, now)).toBe(31);
  });

  it("정확히 쿨다운 경계는 0", () => {
    const last = new Date("2026-05-21T11:00:00Z").toISOString(); // 정확히 60분 전
    expect(computeCooldownRemaining(last, 60, now)).toBe(0);
  });
});
