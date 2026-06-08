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

  it("receivables-mail-school → receivables_mail_sends 조회 + mail-operator 재사용", async () => {
    mockAdmin("receivables_mail_sends", [
      {
        sent_at: "2026-06-08T01:00:18Z",
        recipient_name: "학교담당",
        recipient_email: "school@example.com",
        customer_names: ["A대학교"],
        receivable_count: 2,
        total_amount: 500000,
        status: "sent",
        error_message: null,
      },
    ]);
    const log = await getJobRunLog("receivables-mail-school");
    expect(log.kind).toBe("mail-operator");
    if (log.kind === "mail-operator") {
      expect(log.entries[0].recipientName).toBe("학교담당");
    }
  });

  it("smileedi-mail → smileedi_mail_sends 조회 + smileedi 매핑", async () => {
    mockAdmin("smileedi_mail_sends", [
      {
        sent_at: "2026-06-08T01:01:57Z",
        recipient_name: "박담당",
        recipient_email: "park@example.com",
        company_names: ["A상사"],
        invoice_count: 3,
        total_supply_amount: 2000000,
        status: "sent",
        error_message: null,
      },
    ]);
    const log = await getJobRunLog("smileedi-mail");
    expect(log.kind).toBe("smileedi");
    if (log.kind === "smileedi") {
      expect(log.entries[0].invoiceCount).toBe(3);
    }
  });

  it("service-notice-mail → service_notice_mail_sends 조회 + service-notice 매핑", async () => {
    mockAdmin("service_notice_mail_sends", [
      {
        sent_at: "2026-06-01T01:00:00Z",
        target_month: "2026-07",
        recipient_name: "이운영",
        recipient_email: "lee@example.com",
        service_count: 5,
        status: "sent",
        error_message: null,
      },
    ]);
    const log = await getJobRunLog("service-notice-mail");
    expect(log.kind).toBe("service-notice");
    if (log.kind === "service-notice") {
      expect(log.entries[0].serviceCount).toBe(5);
    }
  });

  it("closing-scrape → closing_services 조회 + scraped_at 배치 그룹핑", async () => {
    mockAdmin("closing_services", [
      {
        scraped_at: "2026-06-07T01:00:00Z",
        university_name: "A대학교",
        service_name: "수시",
      },
      {
        scraped_at: "2026-06-07T01:00:00Z",
        university_name: "B대학교",
        service_name: "정시",
      },
    ]);
    const log = await getJobRunLog("closing-scrape");
    expect(log.kind).toBe("closing-scrape");
    if (log.kind === "closing-scrape") {
      expect(log.entries).toHaveLength(1);
      expect(log.entries[0].serviceCount).toBe(2);
    }
  });

  it("weekly-report-rollover → weekly_report_runs 조회 + weekly-report 매핑", async () => {
    mockAdmin("weekly_report_runs", [
      {
        ran_at: "2026-06-10T01:00:00Z",
        status: "created",
        year: 2026,
        month: 6,
        week: 2,
        file_name: "주간보고_2026_6월2주차.xlsx",
        sender: "전성대",
        share_link: "https://share",
        teams_sent: true,
        message: "차주 보고 생성",
      },
    ]);
    const log = await getJobRunLog("weekly-report-rollover");
    expect(log.kind).toBe("weekly-report");
    if (log.kind === "weekly-report") {
      expect(log.entries[0].status).toBe("created");
      expect(log.entries[0].sender).toBe("전성대");
    }
  });

  it("data가 null이어도 빈 entries", async () => {
    mockAdmin("receivables_match_runs", []);
    const log = await getJobRunLog("receivables-deposit-match");
    expect(log.entries).toEqual([]);
  });
});
