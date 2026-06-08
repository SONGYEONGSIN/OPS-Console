import { describe, it, expect } from "vitest";
import type { MismatchPair } from "@/features/receivables-match/types";
import {
  formatKrw,
  summarizeMismatch,
  summarizeMatch,
  enrichMatchedForLog,
  toDepositMatchEntry,
  toMailOperatorEntry,
  toSmileEdiEntry,
  toServiceNoticeEntry,
  groupInsightsBatches,
} from "../run-logs-normalize";

describe("formatKrw", () => {
  it("천 단위 구분 + ₩ 접두", () => {
    expect(formatKrw(330000)).toBe("₩330,000");
    expect(formatKrw(0)).toBe("₩0");
  });
});

describe("summarizeMismatch", () => {
  it("거래처/금액/입금내용/행번호를 한 줄로 요약", () => {
    const m: MismatchPair = {
      misuRow: 12,
      depRow: 45,
      amount: 330000,
      misuCustomer: "세종고",
      depContent: "세종",
      misuDate: "2026-05-01",
      depDate: "2026-05-03",
    };
    expect(summarizeMismatch(m)).toBe(
      "세종고 ₩330,000 — 입금 '세종' (미수행 12 ↔ 입금행 45)",
    );
  });

  it("빈 값은 ? 로 대체", () => {
    const m: MismatchPair = {
      misuRow: 1,
      depRow: 2,
      amount: 0,
      misuCustomer: "",
      depContent: "",
      misuDate: "",
      depDate: "",
    };
    expect(summarizeMismatch(m)).toBe("? ₩0 — 입금 '?' (미수행 1 ↔ 입금행 2)");
  });
});

describe("enrichMatchedForLog + summarizeMatch (값 표시)", () => {
  it("매칭 쌍에 거래처/거래내용 이름을 붙이고, 줄에 값으로 표시", () => {
    const matched = [
      {
        misuRows: [8],
        depRows: [1761],
        kind: "oneToOne" as const,
        depositDate: "2026-05-27",
        amount: 335000,
      },
    ];
    const misuRows = [{ rowNumber: 8, customer: "한양대학교" }];
    const deposits = [{ row: 1761, content: "한양MBA" }];
    const enriched = enrichMatchedForLog(matched, misuRows, deposits);
    expect(enriched[0].misuCustomers).toEqual(["한양대학교"]);
    expect(enriched[0].depContents).toEqual(["한양MBA"]);
    expect(summarizeMatch(enriched[0])).toBe(
      "₩335,000 1:1 매칭 (한양대학교 ↔ 한양MBA)",
    );
  });

  it("이름이 없는 구(舊) 이력은 행번호로 폴백", () => {
    expect(
      summarizeMatch({
        misuRows: [8],
        depRows: [1761],
        kind: "oneToOne",
        depositDate: "2026-05-27",
        amount: 335000,
      }),
    ).toBe("₩335,000 1:1 매칭 (미수행 8 ↔ 입금행 1761)");
  });

  it("N:1 — 여러 미수 거래처를 join", () => {
    const enriched = enrichMatchedForLog(
      [
        {
          misuRows: [3, 4],
          depRows: [900],
          kind: "nToOne" as const,
          depositDate: "2026-05-20",
          amount: 500000,
        },
      ],
      [
        { rowNumber: 3, customer: "서강대" },
        { rowNumber: 4, customer: "연세대" },
      ],
      [{ row: 900, content: "서강대외국인" }],
    );
    expect(summarizeMatch(enriched[0])).toBe(
      "₩500,000 N:1 매칭 (서강대, 연세대 ↔ 서강대외국인)",
    );
  });
});

describe("toDepositMatchEntry", () => {
  it("payload에서 mismatch/error 줄을 추출", () => {
    const entry = toDepositMatchEntry({
      started_at: "2026-05-31T05:00:00Z",
      finished_at: "2026-05-31T05:00:30Z",
      mode: "live",
      matched_count: 12,
      mismatch_count: 1,
      error_count: 0,
      payload: {
        matched: [],
        mismatches: [
          {
            misuRow: 12,
            depRow: 45,
            amount: 330000,
            misuCustomer: "세종고",
            depContent: "세종",
            misuDate: "2026-05-01",
            depDate: "2026-05-03",
          },
        ],
        errors: [],
      },
    });
    expect(entry.mode).toBe("live");
    expect(entry.matchedCount).toBe(12);
    expect(entry.mismatchLines).toEqual([
      "세종고 ₩330,000 — 입금 '세종' (미수행 12 ↔ 입금행 45)",
    ]);
    expect(entry.errorLines).toEqual([]);
    // 적용 버튼용 구조화 항목 (행번호/거래처/거래내용)
    expect(entry.mismatchItems).toEqual([
      {
        line: "세종고 ₩330,000 — 입금 '세종' (미수행 12 ↔ 입금행 45)",
        misuRow: 12,
        depRow: 45,
        misuCustomer: "세종고",
        depContent: "세종",
      },
    ]);
  });

  it("payload.matched에서 매칭 성공 줄을 추출 (단건/N:1/N:M)", () => {
    const entry = toDepositMatchEntry({
      started_at: "2026-06-01T05:00:00Z",
      finished_at: "2026-06-01T05:00:30Z",
      mode: "live",
      matched_count: 2,
      mismatch_count: 0,
      error_count: 0,
      payload: {
        matched: [
          {
            misuRows: [8],
            depRows: [1761],
            kind: "oneToOne",
            depositDate: "2026-05-27",
            amount: 335000,
          },
          {
            misuRows: [3, 4],
            depRows: [900],
            kind: "nToOne",
            depositDate: "2026-05-20",
            amount: 500000,
          },
        ],
        mismatches: [],
        errors: [],
      },
    });
    expect(entry.matchedLines).toEqual([
      "₩335,000 1:1 매칭 (미수행 8 ↔ 입금행 1761)",
      "₩500,000 N:1 매칭 (미수행 3,4 ↔ 입금행 900)",
    ]);
  });

  it("payload.skips에서 스킵(이미 입금완료) 줄을 추출", () => {
    const entry = toDepositMatchEntry({
      started_at: "2026-06-01T10:00:00Z",
      finished_at: "2026-06-01T10:00:30Z",
      mode: "live",
      matched_count: 0,
      mismatch_count: 0,
      error_count: 0,
      payload: {
        matched: [],
        mismatches: [],
        errors: [],
        skips: ["row 8 이미 입금완료 — skip"],
      },
    });
    expect(entry.skipLines).toEqual(["row 8 이미 입금완료 — skip"]);
    expect(entry.errorLines).toEqual([]);
  });

  it("payload가 null이어도 빈 배열로 안전 처리", () => {
    const entry = toDepositMatchEntry({
      started_at: "2026-05-31T05:00:00Z",
      finished_at: null,
      mode: "dry_run",
      matched_count: 0,
      mismatch_count: 0,
      error_count: 0,
      payload: null,
    });
    expect(entry.finishedAt).toBeNull();
    expect(entry.mismatchLines).toEqual([]);
    expect(entry.errorLines).toEqual([]);
    expect(entry.skipLines).toEqual([]);
    expect(entry.mismatchItems).toEqual([]);
  });
});

describe("toMailOperatorEntry", () => {
  it("발송 row를 정규화", () => {
    const entry = toMailOperatorEntry({
      sent_at: "2026-05-31T01:00:00Z",
      recipient_name: "김운영",
      recipient_email: "kim@example.com",
      customer_names: ["A학교", "B학교"],
      receivable_count: 3,
      total_amount: 1500000,
      status: "sent",
      error_message: null,
    });
    expect(entry).toEqual({
      sentAt: "2026-05-31T01:00:00Z",
      recipientName: "김운영",
      recipientEmail: "kim@example.com",
      customerNames: ["A학교", "B학교"],
      receivableCount: 3,
      totalAmount: 1500000,
      status: "sent",
      errorMessage: null,
    });
  });

  it("customer_names가 null이면 빈 배열", () => {
    const entry = toMailOperatorEntry({
      sent_at: "2026-05-31T01:00:00Z",
      recipient_name: null,
      recipient_email: "x@example.com",
      customer_names: null,
      receivable_count: 0,
      total_amount: 0,
      status: "failed",
      error_message: "Graph 401",
    });
    expect(entry.customerNames).toEqual([]);
    expect(entry.errorMessage).toBe("Graph 401");
  });
});

describe("toSmileEdiEntry", () => {
  it("역발행 발송 row를 정규화", () => {
    const entry = toSmileEdiEntry({
      sent_at: "2026-06-08T01:01:57Z",
      recipient_name: "박담당",
      recipient_email: "park@example.com",
      company_names: ["A상사", "B물산"],
      invoice_count: 4,
      total_supply_amount: 3200000,
      status: "sent",
      error_message: null,
    });
    expect(entry).toEqual({
      sentAt: "2026-06-08T01:01:57Z",
      recipientName: "박담당",
      recipientEmail: "park@example.com",
      companyNames: ["A상사", "B물산"],
      invoiceCount: 4,
      totalSupplyAmount: 3200000,
      status: "sent",
      errorMessage: null,
    });
  });

  it("company_names가 null이면 빈 배열, 금액/건수 null이면 0", () => {
    const entry = toSmileEdiEntry({
      sent_at: "2026-06-08T01:01:57Z",
      recipient_name: null,
      recipient_email: "x@example.com",
      company_names: null,
      invoice_count: null,
      total_supply_amount: null,
      status: "failed",
      error_message: "Graph 500",
    });
    expect(entry.companyNames).toEqual([]);
    expect(entry.invoiceCount).toBe(0);
    expect(entry.totalSupplyAmount).toBe(0);
    expect(entry.errorMessage).toBe("Graph 500");
  });
});

describe("toServiceNoticeEntry", () => {
  it("월별 서비스 알림 발송 row를 정규화", () => {
    const entry = toServiceNoticeEntry({
      sent_at: "2026-06-01T01:00:00Z",
      target_month: "2026-07",
      recipient_name: "이운영",
      recipient_email: "lee@example.com",
      service_count: 5,
      status: "sent",
      error_message: null,
    });
    expect(entry).toEqual({
      sentAt: "2026-06-01T01:00:00Z",
      targetMonth: "2026-07",
      recipientName: "이운영",
      recipientEmail: "lee@example.com",
      serviceCount: 5,
      status: "sent",
      errorMessage: null,
    });
  });

  it("service_count null이면 0", () => {
    const entry = toServiceNoticeEntry({
      sent_at: "2026-06-01T01:00:00Z",
      target_month: "2026-07",
      recipient_name: null,
      recipient_email: "x@example.com",
      service_count: null,
      status: "dry_run",
      error_message: null,
    });
    expect(entry.serviceCount).toBe(0);
    expect(entry.recipientName).toBeNull();
  });
});

describe("groupInsightsBatches", () => {
  const rows = [
    { collected_at: "2026-05-31T08:00:00Z", title: "A", view_count: 100 },
    { collected_at: "2026-05-31T08:00:00Z", title: "B", view_count: 500 },
    { collected_at: "2026-05-31T08:00:00Z", title: "C", view_count: 300 },
    { collected_at: "2026-05-30T08:00:00Z", title: "D", view_count: 50 },
  ];

  it("collected_at 단위로 그룹핑하고 최신순 정렬", () => {
    const batches = groupInsightsBatches(rows, 10, 2);
    expect(batches).toHaveLength(2);
    expect(batches[0].collectedAt).toBe("2026-05-31T08:00:00Z");
    expect(batches[0].videoCount).toBe(3);
    expect(batches[1].collectedAt).toBe("2026-05-30T08:00:00Z");
    expect(batches[1].videoCount).toBe(1);
  });

  it("sampleTitles는 조회수 내림차순 + sampleSize 제한", () => {
    const batches = groupInsightsBatches(rows, 10, 2);
    expect(batches[0].sampleTitles).toEqual(["B", "C"]);
  });

  it("maxBatches로 배치 수 제한", () => {
    const batches = groupInsightsBatches(rows, 1, 3);
    expect(batches).toHaveLength(1);
    expect(batches[0].collectedAt).toBe("2026-05-31T08:00:00Z");
  });
});
