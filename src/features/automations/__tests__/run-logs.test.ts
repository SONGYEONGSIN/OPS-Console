import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { getJobRunLog } from "../run-logs";

/**
 * admin.from(table).select(...).order(...).limit(...) 체인을 모킹.
 * 마지막 limit()가 { data } 를 resolve한다.
 */
function mockAdmin(table: string, data: unknown[]) {
  const limit = vi.fn().mockResolvedValue({ data });
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn((t: string) => {
    expect(t).toBe(table);
    return { select };
  });
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from,
  });
  return { from, select, order, limit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getJobRunLog", () => {
  it("알 수 없는 jobId → kind:none", async () => {
    const log = await getJobRunLog("nope");
    expect(log).toEqual({ jobId: "nope", kind: "none", entries: [] });
  });

  it("receivables-deposit-match → match_runs 조회 + 매핑", async () => {
    mockAdmin("receivables_match_runs", [
      {
        started_at: "2026-05-31T05:00:00Z",
        finished_at: "2026-05-31T05:00:30Z",
        mode: "live",
        matched_count: 2,
        mismatch_count: 0,
        error_count: 0,
        payload: { matched: [], mismatches: [], errors: [] },
      },
    ]);
    const log = await getJobRunLog("receivables-deposit-match");
    expect(log.kind).toBe("deposit-match");
    expect(log.entries).toHaveLength(1);
    if (log.kind === "deposit-match") {
      expect(log.entries[0].matchedCount).toBe(2);
    }
  });

  it("receivables-mail-operator → operator_mail_sends 조회 + 매핑", async () => {
    mockAdmin("receivables_operator_mail_sends", [
      {
        sent_at: "2026-05-31T01:00:00Z",
        recipient_name: "김운영",
        recipient_email: "kim@example.com",
        customer_names: ["A"],
        receivable_count: 1,
        total_amount: 1000,
        status: "sent",
        error_message: null,
      },
    ]);
    const log = await getJobRunLog("receivables-mail-operator");
    expect(log.kind).toBe("mail-operator");
    if (log.kind === "mail-operator") {
      expect(log.entries[0].recipientName).toBe("김운영");
    }
  });

  it("insights-collect → insight_videos 조회 + 배치 그룹핑", async () => {
    mockAdmin("insight_videos", [
      { collected_at: "2026-05-31T08:00:00Z", title: "A", view_count: 100 },
      { collected_at: "2026-05-31T08:00:00Z", title: "B", view_count: 200 },
    ]);
    const log = await getJobRunLog("insights-collect");
    expect(log.kind).toBe("insights");
    if (log.kind === "insights") {
      expect(log.entries).toHaveLength(1);
      expect(log.entries[0].videoCount).toBe(2);
    }
  });

  it("data가 null이어도 빈 entries", async () => {
    mockAdmin("receivables_match_runs", []);
    const log = await getJobRunLog("receivables-deposit-match");
    expect(log.entries).toEqual([]);
  });
});
