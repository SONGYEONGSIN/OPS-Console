import { describe, it, expect } from "vitest";
import type { MismatchPair } from "@/features/receivables-match/types";
import {
  formatKrw,
  summarizeMismatch,
  toDepositMatchEntry,
  toMailOperatorEntry,
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
