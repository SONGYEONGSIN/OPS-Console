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
  // notice-teams resolver는 .eq(...).not(...) 필터 체인을 거치므로 self를 반환해
  // .order()까지 도달하도록 한다(다른 resolver는 select→order 직행).
  const builder: Record<string, unknown> = { order };
  const eq = vi.fn(() => builder);
  const not = vi.fn(() => builder);
  // mail-school resolver는 .is("triggered_by", null)로 수동 발송을 걸러낸다.
  const is = vi.fn(() => builder);
  builder.eq = eq;
  builder.not = not;
  builder.is = is;
  const select = vi.fn(() => builder);
  const from = vi.fn((t: string) => {
    expect(t).toBe(table);
    return { select };
  });
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from,
  });
  return { from, select, eq, not, is, order, limit };
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

  it("receivables-mail-school → 수동 발송(triggered_by not null) 제외 필터 적용", async () => {
    const { is } = mockAdmin("receivables_mail_sends", []);
    await getJobRunLog("receivables-mail-school");
    // 자동화 실행 로그에는 cron 발송만 — 수동 발송은 triggered_by가 채워진다.
    expect(is).toHaveBeenCalledWith("triggered_by", null);
  });

  it("receivables-mail-operator → triggered_by 필터를 걸지 않는다 (수동 경로 없음)", async () => {
    const { is } = mockAdmin("receivables_operator_mail_sends", []);
    await getJobRunLog("receivables-mail-operator");
    expect(is).not.toHaveBeenCalled();
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

  it("notice-teams-share → posts 공유 공지 조회 + notice-teams 매핑", async () => {
    mockAdmin("posts", [
      {
        title: "정기 점검 안내",
        notice_shared_at: "2026-06-20T01:00:00Z",
        owner_label: "운영부",
        author_email: "ops@example.com",
      },
    ]);
    const log = await getJobRunLog("notice-teams-share");
    expect(log.kind).toBe("notice-teams");
    if (log.kind === "notice-teams") {
      expect(log.entries[0].title).toBe("정기 점검 안내");
      expect(log.entries[0].author).toBe("운영부");
      expect(log.entries[0].sharedAt).toBe("2026-06-20T01:00:00Z");
    }
  });

  it("closing-scrape → closing_scrape_runs 실행 기록 조회 + 매핑", async () => {
    mockAdmin("closing_scrape_runs", [
      {
        ran_at: "2026-06-08T01:00:00Z",
        status: "failed",
        service_count: 0,
        message: "TimeoutException: 로그인 폼 미등장",
      },
    ]);
    const log = await getJobRunLog("closing-scrape");
    expect(log.kind).toBe("closing-scrape");
    if (log.kind === "closing-scrape") {
      expect(log.entries[0].status).toBe("failed");
      expect(log.entries[0].message).toContain("Timeout");
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
