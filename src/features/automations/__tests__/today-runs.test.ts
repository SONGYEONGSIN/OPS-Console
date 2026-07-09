import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  kstDayRangeIso,
  aggregateSourceRuns,
  fetchSourceRuns,
  RUN_SOURCES,
} from "../today-runs";

const SRC = {
  jobId: "insights-collect",
  table: "insight_videos",
  col: "collected_at",
  label: "인사이트 영상 수집",
};

describe("aggregateSourceRuns", () => {
  it("행이 없으면 null (오늘 미실행 → 타임라인 미표시)", () => {
    expect(aggregateSourceRuns(SRC, [])).toBeNull();
  });

  it("N행을 1엔트리로 집계하고 가장 늦은 시각을 위치로 쓴다", () => {
    const rows = [
      { collected_at: "2026-06-15T01:00:00+00:00" },
      { collected_at: "2026-06-15T01:00:09+00:00" },
      { collected_at: "2026-06-15T01:00:05+00:00" },
    ];
    expect(aggregateSourceRuns(SRC, rows)).toEqual({
      id: "insights-collect",
      atIso: "2026-06-15T01:00:09+00:00",
      label: "인사이트 영상 수집",
      count: 3,
    });
  });

  it("col 값이 비었거나 문자열이 아니면 count에서 제외한다", () => {
    const rows = [
      { collected_at: "2026-06-15T01:00:00+00:00" },
      { collected_at: "" },
      { collected_at: null },
      { collected_at: 123 },
    ];
    expect(aggregateSourceRuns(SRC, rows)).toEqual({
      id: "insights-collect",
      atIso: "2026-06-15T01:00:00+00:00",
      label: "인사이트 영상 수집",
      count: 1,
    });
  });

  it("유효 값이 하나도 없으면 null", () => {
    expect(aggregateSourceRuns(SRC, [{ collected_at: "" }])).toBeNull();
  });
});

/** admin.from(t).select(c).gte().lt().is()?.order().limit() 체인 모킹 */
function mockAdmin() {
  const limit = vi.fn().mockResolvedValue({ data: [] });
  const builder: Record<string, unknown> = {};
  const order = vi.fn(() => ({ limit }));
  const gte = vi.fn(() => builder);
  const lt = vi.fn(() => builder);
  const is = vi.fn(() => builder);
  builder.order = order;
  builder.gte = gte;
  builder.lt = lt;
  builder.is = is;
  const select = vi.fn(() => builder);
  const from = vi.fn(() => ({ select }));
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from,
  });
  return { is };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchSourceRuns — 수동 발송 제외", () => {
  it("학교담당자 잡 소스는 cronOnlyCol='triggered_by' 로 설정된다", () => {
    const school = RUN_SOURCES.find(
      (s) => s.jobId === "receivables-mail-school",
    );
    expect(school?.cronOnlyCol).toBe("triggered_by");
  });

  it("다른 잡 소스에는 cronOnlyCol 이 없다", () => {
    const others = RUN_SOURCES.filter(
      (s) => s.jobId !== "receivables-mail-school",
    );
    expect(others.every((s) => s.cronOnlyCol === undefined)).toBe(true);
  });

  it("cronOnlyCol 이 있으면 .is(col, null) 필터를 건다", async () => {
    const { is } = mockAdmin();
    const school = RUN_SOURCES.find(
      (s) => s.jobId === "receivables-mail-school",
    )!;
    await fetchSourceRuns(
      school,
      "2026-07-09T00:00:00+09:00",
      "2026-07-10T00:00:00+09:00",
    );
    expect(is).toHaveBeenCalledWith("triggered_by", null);
  });

  it("cronOnlyCol 이 없으면 필터를 걸지 않는다", async () => {
    const { is } = mockAdmin();
    const other = RUN_SOURCES.find((s) => s.jobId === "insights-collect")!;
    await fetchSourceRuns(
      other,
      "2026-07-09T00:00:00+09:00",
      "2026-07-10T00:00:00+09:00",
    );
    expect(is).not.toHaveBeenCalled();
  });
});

describe("kstDayRangeIso", () => {
  it("그 날 00:00 ~ 익일 00:00 (KST) ISO 경계를 만든다", () => {
    expect(kstDayRangeIso("2026-06-14")).toEqual({
      startIso: "2026-06-14T00:00:00+09:00",
      endIso: "2026-06-15T00:00:00+09:00",
    });
  });

  it("월말 → 다음 달 1일로 넘어간다 (윤년 2월 포함)", () => {
    expect(kstDayRangeIso("2026-02-28")).toEqual({
      startIso: "2026-02-28T00:00:00+09:00",
      endIso: "2026-03-01T00:00:00+09:00",
    });
  });

  it("연말 → 다음 해 1월 1일로 넘어간다", () => {
    expect(kstDayRangeIso("2026-12-31")).toEqual({
      startIso: "2026-12-31T00:00:00+09:00",
      endIso: "2027-01-01T00:00:00+09:00",
    });
  });

  it("윤년 2월 29일 → 3월 1일", () => {
    // 2028은 윤년
    expect(kstDayRangeIso("2028-02-29")).toEqual({
      startIso: "2028-02-29T00:00:00+09:00",
      endIso: "2028-03-01T00:00:00+09:00",
    });
  });
});
