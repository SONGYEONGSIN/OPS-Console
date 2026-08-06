import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 마지막 실행 조회는 cron(세션 없음)에서도 같은 값을 내야 한다.
 *
 * 폴백 리졸버가 RLS server client를 쓰면 정책이 `to authenticated`인 테이블
 * (closing_scrape_runs 등)을 cron에서 못 읽어 null이 된다. 그러면 자동화 일일 보고가
 * 멀쩡히 돌아간 잡을 '미실행'으로 오판한다.
 */

const h = vi.hoisted(() => ({
  adminMaybeSingle: vi.fn(),
  serverMaybeSingle: vi.fn(),
  adminTables: [] as string[],
  serverTables: [] as string[],
}));

function chain(tables: string[], maybeSingle: ReturnType<typeof vi.fn>) {
  return {
    from: (table: string) => {
      tables.push(table);
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle,
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => chain(h.adminTables, h.adminMaybeSingle),
}));
vi.mock("@/lib/supabase/server", () => ({
  // cron에는 요청 스코프가 없어 쿠키 기반 클라이언트 생성 자체가 터진다.
  createClient: async () => {
    throw new Error("`cookies` was called outside a request scope.");
  },
}));

import { getJobLastRunAt } from "../queries";

describe("getJobLastRunAt — 세션 없는 cron 경로", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.adminTables.length = 0;
    h.serverTables.length = 0;
  });

  it("automation_runs에 기록이 있으면 그 값을 쓴다", async () => {
    h.adminMaybeSingle.mockResolvedValue({
      data: { ran_at: "2026-08-06T09:00:00+09:00" },
    });
    await expect(getJobLastRunAt("closing-scrape")).resolves.toBe(
      "2026-08-06T09:00:00+09:00",
    );
    expect(h.adminTables[0]).toBe("automation_runs");
  });

  it("automation_runs가 비면 폴백도 세션 없이 읽어낸다", async () => {
    h.adminMaybeSingle
      .mockResolvedValueOnce({ data: null }) // automation_runs 없음
      .mockResolvedValueOnce({ data: { ran_at: "2026-08-05T09:00:00+09:00" } });
    await expect(getJobLastRunAt("closing-scrape")).resolves.toBe(
      "2026-08-05T09:00:00+09:00",
    );
    expect(h.adminTables).toEqual(["automation_runs", "closing_scrape_runs"]);
  });

  it("발송 이력 폴백도 마찬가지", async () => {
    h.adminMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({
        data: { sent_at: "2026-08-05T10:00:00+09:00" },
      });
    await expect(getJobLastRunAt("receivables-mail-school")).resolves.toBe(
      "2026-08-05T10:00:00+09:00",
    );
    expect(h.adminTables).toEqual([
      "automation_runs",
      "receivables_mail_sends",
    ]);
  });
});
