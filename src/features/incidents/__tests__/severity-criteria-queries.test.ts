import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockResult, fromCalls, selectCalls } = vi.hoisted(() => ({
  mockResult: vi.fn(),
  fromCalls: [] as string[],
  selectCalls: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      fromCalls.push(table);
      return {
        select: (cols: string) => {
          selectCalls.push(cols);
          return Promise.resolve(mockResult());
        },
      };
    },
  })),
}));

import { getSeverityCriteria } from "../severity-criteria-queries";

const rows = [
  { severity: "심각", description: "다수 지원자 영향" },
  { severity: "높음", description: "여러 지원자 영향" },
  { severity: "보통", description: "일부 지원자 영향" },
  { severity: "낮음", description: "지원자 영향 없음" },
];

beforeEach(() => {
  mockResult.mockReset();
  fromCalls.length = 0;
  selectCalls.length = 0;
});

describe("getSeverityCriteria", () => {
  it("기준 표에서 등급·설명을 읽는다", async () => {
    mockResult.mockReturnValue({ data: rows, error: null });
    await getSeverityCriteria();
    expect(fromCalls).toEqual(["incident_severity_criteria"]);
    expect(selectCalls).toEqual(["severity, description"]);
  });

  it("4행은 그대로 등급 → 설명 맵이 된다", async () => {
    mockResult.mockReturnValue({ data: rows, error: null });
    expect(await getSeverityCriteria()).toEqual({
      심각: "다수 지원자 영향",
      높음: "여러 지원자 영향",
      보통: "일부 지원자 영향",
      낮음: "지원자 영향 없음",
    });
  });

  it("빠진 등급은 빈 문자열", async () => {
    mockResult.mockReturnValue({
      data: rows.filter((r) => r.severity !== "보통"),
      error: null,
    });
    const r = await getSeverityCriteria();
    expect(r?.보통).toBe("");
    expect(r?.심각).toBe("다수 지원자 영향");
  });

  it("모르는 등급 행은 무시한다", async () => {
    mockResult.mockReturnValue({
      data: [...rows, { severity: "긴급", description: "x" }],
      error: null,
    });
    const r = await getSeverityCriteria();
    expect(Object.keys(r ?? {})).toEqual(["심각", "높음", "보통", "낮음"]);
  });

  it("조회 오류면 null — 툴팁이 '불러오지 못했습니다' 를 띄운다", async () => {
    mockResult.mockReturnValue({
      data: null,
      error: { message: "permission denied" },
    });
    expect(await getSeverityCriteria()).toBeNull();
  });
});
