import { describe, it, expect } from "vitest";
import { parseBaejungList } from "../parse";
import type { AssignmentSheet } from "../schemas";

// r0=블록 라벨, r1=sub-type, r2~=데이터. 컬럼: A NO, B 대분류, C 지역, D 대학명,
// E UnivID ... M~R 2027운영(재외/수시/정시/편입/외국인/백업), S~X 2027개발, Y~^ 2026운영, _~d 2026개발
function cell(idx: number, val: string, width = 36): string[] {
  const r = Array(width).fill("");
  r[idx] = val;
  return r;
}
function mergeRows(...rows: string[][]): string[] {
  const out = Array(36).fill("");
  for (const r of rows) r.forEach((v, i) => { if (v) out[i] = v; });
  return out;
}

const sheet: AssignmentSheet = {
  worksheetName: "02. 배정리스트",
  rowsText: [
    // r0 블록 라벨: M(12)=2027학년도 운영자, S(18)=2027학년도 개발자, Y(24)=2026학년도 운영자, _(30)=2026학년도 개발자, D(3)=대학명
    mergeRows(cell(3, "대학명"), cell(12, "2027학년도 운영자"), cell(18, "2027학년도 개발자"), cell(24, "2026학년도 운영자"), cell(30, "2026학년도 개발자")),
    // r1 sub-type (각 블록 재외/수시/정시/편입/외국인/백업)
    mergeRows(
      cell(12, "재외"), cell(13, "수시"), cell(14, "정시"), cell(15, "편입"), cell(16, "외국인"), cell(17, "백업"),
      cell(18, "재외"), cell(19, "수시"), cell(20, "정시"), cell(21, "편입"), cell(22, "외국인"), cell(23, "백업"),
      cell(24, "재외"), cell(25, "수시"), cell(26, "정시"), cell(27, "편입"), cell(28, "외국인"), cell(29, "백업"),
      cell(30, "재외"), cell(31, "수시"), cell(32, "정시"), cell(33, "편입"), cell(34, "외국인"), cell(35, "백업"),
    ),
    // r2 데이터: 신성대학교, 2027 수시운영=N(13)=기자의, 2027 수시개발=T(19)=권용철, 2027 정시운영=O(14)=김슬기
    mergeRows(cell(3, "신성대학교"), cell(13, "기자의"), cell(14, "김슬기"), cell(19, "권용철"), cell(25, "기존운영")),
  ],
  rowCount: 3,
  columnCount: 36,
};

describe("parseBaejungList", () => {
  it("수시 기준 운영/개발을 그리드 대표값으로 추출", () => {
    const recs = parseBaejungList(sheet);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      university: "신성대학교",
      service: "원서접수",
      operator: "기자의", // 2027 수시 운영 (N)
      developer: "권용철", // 2027 수시 개발 (T)
    });
  });

  it("인스펙터 detail에 sub-type/연도 항목 포함", () => {
    const recs = parseBaejungList(sheet);
    const labels = recs[0].detail.map((d) => d.label);
    expect(labels).toContain("2027 정시 운영");
    expect(recs[0].detail.find((d) => d.label === "2027 정시 운영")?.value).toBe("김슬기");
    expect(labels).toContain("2026 수시 운영");
  });

  it("대학명 빈 행은 제외", () => {
    const empty: AssignmentSheet = { ...sheet, rowsText: [...sheet.rowsText, Array(36).fill("")] };
    expect(parseBaejungList(empty)).toHaveLength(1);
  });
});
