import { describe, it, expect } from "vitest";
import { detectHeaderIndex } from "../queries";

describe("detectHeaderIndex", () => {
  it("4년제 시트 패턴 — row 0이 헤더지만 data row가 더 많이 채워진 경우 row 0 detect (키워드 우선)", () => {
    // 4년제 실제 SharePoint 시트 첫 5행 (간소화)
    const text = [
      // row 0 — 진짜 헤더 (빈 셀 다수 — 카테고리 그룹 헤더가 sub-header로 분리)
      [
        "스캔본",
        "원본",
        "넘버링",
        "서비스여부",
        "지역",
        "대학명",
        "",
        "",
        "영업자",
        "운영자",
        "계약진행현황",
      ],
      // row 1 — sub-header (대부분 빈, 일부 카테고리 명)
      ["", "", "", "", "", "", "수시", "정시", "", "", ""],
      // row 2 — data
      ["", "", "A-1-01", "Y", "경남", "가야대학교", "", "", "윤영호", "김유민", ""],
      // row 3 — data (옵션 셀이 다 채워져 row 0보다 non-empty 많을 수 있음)
      [
        "○",
        "○",
        "A-1-02",
        "Y",
        "경기",
        "가천대학교",
        "단독",
        "단독",
        "김은호",
        "허승철",
        "계약완료",
      ],
      // row 4 — data
      ["", "", "A-1-03", "Y", "서울", "가톨릭대학교", "", "", "김신강", "정윤나", ""],
    ];
    expect(detectHeaderIndex(text)).toBe(0);
  });

  it("헤더 키워드 미존재 시 fallback — non-empty 셀 가장 많은 행", () => {
    const text = [
      ["", "", ""],
      ["A", "", ""],
      ["A", "B", "C"],
    ];
    expect(detectHeaderIndex(text)).toBe(2);
  });

  it("헤더가 row 2에 있어도 키워드로 detect", () => {
    const text = [
      ["제목 행", "", "", ""],
      ["", "", "", ""],
      ["넘버링", "대학명", "운영자", "계약진행현황"],
      ["A-1-01", "가야대", "김유민", ""],
    ];
    expect(detectHeaderIndex(text)).toBe(2);
  });

  it("빈 input → 0", () => {
    expect(detectHeaderIndex([])).toBe(0);
  });
});
