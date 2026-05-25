import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/features/contracts/queries", () => ({
  listContracts: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: vi.fn(async () => null),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPeriodRange,
  getPrevPeriodRange,
  getReportKpis,
} from "../queries";

function mockAdmin(counts: Record<string, number>) {
  const from = vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      count: counts[table] ?? 0,
      error: null,
    }),
  }));
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  // 2026-05-25(월) KST 12:00 고정 — period 계산 검증 기준일
  vi.setSystemTime(new Date("2026-05-25T03:00:00Z"));
});

describe("getPeriodRange — KST 기준 기간 범위", () => {
  it("this-week → 월~일", () => {
    const r = getPeriodRange("this-week");
    expect(r.startYmd).toBe("2026-05-25"); // 월
    expect(r.endYmd).toBe("2026-05-31"); // 일
  });

  it("this-month → 1일~말일", () => {
    const r = getPeriodRange("this-month");
    expect(r.startYmd).toBe("2026-05-01");
    expect(r.endYmd).toBe("2026-05-31");
  });

  it("last-month → 지난 달 1일~말일", () => {
    const r = getPeriodRange("last-month");
    expect(r.startYmd).toBe("2026-04-01");
    expect(r.endYmd).toBe("2026-04-30");
  });

  it("quarter → 이번 분기 (Q2: 4~6월)", () => {
    const r = getPeriodRange("quarter");
    expect(r.startYmd).toBe("2026-04-01");
    expect(r.endYmd).toBe("2026-06-30");
  });

  it("year → 1.1~12.31", () => {
    const r = getPeriodRange("year");
    expect(r.startYmd).toBe("2026-01-01");
    expect(r.endYmd).toBe("2026-12-31");
  });
});

describe("getPrevPeriodRange — 전 기간 (비교용)", () => {
  it("this-month → 직전 달", () => {
    const r = getPrevPeriodRange("this-month");
    expect(r.startYmd).toBe("2026-04-01");
    expect(r.endYmd).toBe("2026-04-30");
  });

  it("quarter → 직전 분기 (Q1)", () => {
    const r = getPrevPeriodRange("quarter");
    expect(r.startYmd).toBe("2026-01-01");
    expect(r.endYmd).toBe("2026-03-31");
  });

  it("year → 전년도", () => {
    const r = getPrevPeriodRange("year");
    expect(r.startYmd).toBe("2025-01-01");
    expect(r.endYmd).toBe("2025-12-31");
  });
});

describe("getReportKpis", () => {
  it("8 카드 항목 모두 포함 (service-open/incident/contract/receivables/handover/backup/mail/worklog)", async () => {
    mockAdmin({});
    const snap = await getReportKpis("this-month");
    const keys = snap.kpis.map((k) => k.key).sort();
    expect(keys).toEqual([
      "backup",
      "contract",
      "handover",
      "incident",
      "mail",
      "receivables",
      "service-open",
      "worklog",
    ]);
  });

  it("period + periodRange 포함", async () => {
    mockAdmin({});
    const snap = await getReportKpis("this-month");
    expect(snap.period).toBe("this-month");
    expect(snap.periodRange.startYmd).toBe("2026-05-01");
    expect(snap.periodRange.endYmd).toBe("2026-05-31");
  });

  it("incident는 goodOnIncrease=false (사고는 감소가 good)", async () => {
    mockAdmin({});
    const snap = await getReportKpis("this-month");
    const incident = snap.kpis.find((k) => k.key === "incident");
    expect(incident?.goodOnIncrease).toBe(false);
  });

  it("services는 goodOnIncrease=true", async () => {
    mockAdmin({});
    const snap = await getReportKpis("this-month");
    const service = snap.kpis.find((k) => k.key === "service-open");
    expect(service?.goodOnIncrease).toBe(true);
  });
});
