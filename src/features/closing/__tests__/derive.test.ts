import { describe, it, expect } from "vitest";
import type { ClosingRow } from "../schemas";
import {
  imminentClosings,
  upcomingOpens,
  openingsWithin,
  monthRange,
} from "../derive";

/** ClosingRow 최소 팩토리 — 테스트 관심 필드만 덮어쓴다. */
function row(partial: Partial<ClosingRow>): ClosingRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    service_id: 1,
    university_name: "대학",
    region: null,
    service_name: "서비스",
    university_type: null,
    category: null,
    admission_type: null,
    operator_name: null,
    developer_name: null,
    write_start_at: null,
    write_end_at: "2026-06-16T00:00:00+09:00",
    pay_start_at: null,
    pay_end_at: null,
    solo: false,
    scraped_at: "2026-06-16T00:00:00+09:00",
    created_at: "2026-06-16T00:00:00+09:00",
    updated_at: "2026-06-16T00:00:00+09:00",
    ...partial,
  };
}

const TODAY = "2026-06-16";

describe("imminentClosings — 결제마감 D-3 이내", () => {
  it("pay_end_at이 오늘(D-0)인 건을 포함한다", () => {
    const rows = [row({ pay_end_at: "2026-06-16T18:00:00+09:00" })];
    expect(imminentClosings(rows, TODAY)).toHaveLength(1);
  });

  it("pay_end_at이 D-3(오늘+3)인 건을 포함한다", () => {
    const rows = [row({ pay_end_at: "2026-06-19T09:00:00+09:00" })];
    expect(imminentClosings(rows, TODAY)).toHaveLength(1);
  });

  it("pay_end_at이 D-4(오늘+4)인 건은 제외한다", () => {
    const rows = [row({ pay_end_at: "2026-06-20T09:00:00+09:00" })];
    expect(imminentClosings(rows, TODAY)).toHaveLength(0);
  });

  it("pay_end_at이 어제(이미 마감)인 건은 제외한다", () => {
    const rows = [row({ pay_end_at: "2026-06-15T23:59:00+09:00" })];
    expect(imminentClosings(rows, TODAY)).toHaveLength(0);
  });

  it("pay_end_at null이면 제외한다", () => {
    const rows = [row({ pay_end_at: null })];
    expect(imminentClosings(rows, TODAY)).toHaveLength(0);
  });

  it("pay_end_at 오름차순으로 정렬한다", () => {
    const rows = [
      row({ id: "c", pay_end_at: "2026-06-18T09:00:00+09:00" }),
      row({ id: "a", pay_end_at: "2026-06-16T09:00:00+09:00" }),
      row({ id: "b", pay_end_at: "2026-06-17T09:00:00+09:00" }),
    ];
    expect(imminentClosings(rows, TODAY).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("upcomingOpens — 작성시작(오픈) 예정", () => {
  it("write_start_at이 오늘 이상인 건을 포함한다", () => {
    const rows = [row({ write_start_at: "2026-06-16T09:00:00+09:00" })];
    expect(upcomingOpens(rows, TODAY)).toHaveLength(1);
  });

  it("write_start_at이 과거인 건은 제외한다", () => {
    const rows = [row({ write_start_at: "2026-06-10T09:00:00+09:00" })];
    expect(upcomingOpens(rows, TODAY)).toHaveLength(0);
  });

  it("write_start_at이 null인 건은 제외한다", () => {
    const rows = [row({ write_start_at: null })];
    expect(upcomingOpens(rows, TODAY)).toHaveLength(0);
  });

  it("write_start_at 오름차순으로 정렬한다", () => {
    const rows = [
      row({ id: "late", write_start_at: "2026-07-01T09:00:00+09:00" }),
      row({ id: "soon", write_start_at: "2026-06-20T09:00:00+09:00" }),
    ];
    expect(upcomingOpens(rows, TODAY).map((r) => r.id)).toEqual([
      "soon",
      "late",
    ]);
  });
});

describe("openingsWithin — 오픈 예정 중 오늘~N일 이내(triage 노출용)", () => {
  it("오늘(D-0) 오픈 건을 포함한다", () => {
    const rows = [row({ write_start_at: "2026-06-16T09:00:00+09:00" })];
    expect(openingsWithin(rows, TODAY)).toHaveLength(1);
  });

  it("D-7(오늘+7) 오픈 건을 포함한다 (기본 범위 경계)", () => {
    const rows = [row({ write_start_at: "2026-06-23T09:00:00+09:00" })];
    expect(openingsWithin(rows, TODAY)).toHaveLength(1);
  });

  it("D-8(오늘+8) 오픈 건은 제외한다 (track 비대 방지)", () => {
    const rows = [row({ write_start_at: "2026-06-24T09:00:00+09:00" })];
    expect(openingsWithin(rows, TODAY)).toHaveLength(0);
  });

  it("과거 오픈 건은 제외한다", () => {
    const rows = [row({ write_start_at: "2026-06-10T09:00:00+09:00" })];
    expect(openingsWithin(rows, TODAY)).toHaveLength(0);
  });

  it("같은 날 여러 건(오늘 오픈 다수)을 모두 포함한다 — cap 없음", () => {
    const rows = Array.from({ length: 27 }, (_, i) =>
      row({ id: `o${i}`, write_start_at: "2026-06-16T09:00:00+09:00" }),
    );
    expect(openingsWithin(rows, TODAY)).toHaveLength(27);
  });

  it("withinDays 커스텀 — 0이면 오늘만", () => {
    const rows = [
      row({ id: "today", write_start_at: "2026-06-16T09:00:00+09:00" }),
      row({ id: "tomorrow", write_start_at: "2026-06-17T09:00:00+09:00" }),
    ];
    expect(openingsWithin(rows, TODAY, 0).map((r) => r.id)).toEqual(["today"]);
  });

  it("write_start_at 오름차순 정렬", () => {
    const rows = [
      row({ id: "d3", write_start_at: "2026-06-19T09:00:00+09:00" }),
      row({ id: "d0", write_start_at: "2026-06-16T09:00:00+09:00" }),
    ];
    expect(openingsWithin(rows, TODAY).map((r) => r.id)).toEqual(["d0", "d3"]);
  });
});

describe("monthRange — YYYY-MM → [start, end) 경계", () => {
  it("일반 월: 7월 → 2026-07-01 ~ 2026-08-01", () => {
    expect(monthRange("2026-07")).toEqual({
      start: "2026-07-01",
      end: "2026-08-01",
    });
  });

  it("12월 → 다음 해 1월로 롤오버", () => {
    expect(monthRange("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
  });

  it("1월 경계", () => {
    expect(monthRange("2027-01")).toEqual({
      start: "2027-01-01",
      end: "2027-02-01",
    });
  });

  it("형식 오류 → null", () => {
    expect(monthRange("2026")).toBeNull();
    expect(monthRange("")).toBeNull();
    expect(monthRange("2026-13")).toBeNull();
  });
});
