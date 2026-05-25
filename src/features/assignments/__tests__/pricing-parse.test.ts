import { describe, it, expect } from "vitest";
import { parsePricingSheet } from "../pricing-parse";
import type { AssignmentSheet } from "../schemas";

function pad(row: string[], width: number): string[] {
  const r = Array(width).fill("");
  row.forEach((v, i) => {
    r[i] = v;
  });
  return r;
}

function makeSheet(rows: string[][], columnCount = 15): AssignmentSheet {
  return {
    worksheetName: "(참고) 가격정책",
    rowsText: rows.map((r) => pad(r, columnCount)),
    rowCount: rows.length,
    columnCount,
  };
}

describe("parsePricingSheet", () => {
  it("빈 시트 → 카테고리 모두 빈 배열", () => {
    expect(parsePricingSheet(makeSheet([]))).toEqual({
      원서접수: [],
      PIMS: [],
      입학상담앱: [],
    });
  });

  it("좌측(col 0~4) 빈 행 split → 원서접수 카테고리 섹션 2개", () => {
    const sheet = makeSheet([
      ["섹션1 제목"],
      ["헤더A", "헤더B"],
      ["값A", "값B"],
      [],
      ["섹션2 제목"],
      ["값C", "값D"],
    ]);
    const { 원서접수, PIMS, 입학상담앱 } = parsePricingSheet(sheet);
    expect(PIMS).toEqual([]);
    expect(입학상담앱).toEqual([]);
    expect(원서접수).toHaveLength(2);
    expect(원서접수[0]).toMatchObject({
      category: "원서접수",
      title: "섹션1 제목",
      rows: [
        ["헤더A", "헤더B"],
        ["값A", "값B"],
      ],
    });
    expect(원서접수[1]).toMatchObject({
      category: "원서접수",
      title: "섹션2 제목",
      rows: [["값C", "값D"]],
    });
  });

  it("하단 row 17+의 중간(col 5~9) 섹션도 원서접수 카테고리에 합산 (좌·중 분리 영역)", () => {
    // 상단(row 0~16)은 col 0~9 통합 영역이므로 좌·중 분리 테스트는 row 17+에서 진행
    const rows: string[][] = Array.from({ length: 17 }, () => []);
    rows.push(["좌측섹션"]);
    rows.push(["좌헤더", "좌값"]);
    rows.push(["", "", "", "", "", "중간섹션"]);
    rows.push(["", "", "", "", "", "중헤더", "중값"]);
    const sheet = makeSheet(rows);
    const { 원서접수 } = parsePricingSheet(sheet);
    const titles = 원서접수.map((s) => s.title);
    expect(titles).toContain("좌측섹션");
    expect(titles).toContain("중간섹션");
    expect(원서접수.every((s) => s.category === "원서접수")).toBe(true);
  });

  it("상단(row 0~16)은 col 0~9 통합 영역 — '서비스 제공 기준' 매트릭스 1 섹션으로 추출", () => {
    // row 4 헤더가 col 0~9에 걸친 표 (서비스 제공 기준)
    const rows: string[][] = [
      ["1. 원서접수"],
      [],
      ["서비스 제공 기준"],
      ["○:서비스가능 / X:서비스불가"],
      ["서비스 구분", "부가서비스 제공기준", "", "", "", "", "", "", "", "비고"],
      ["", "기본접수", "경쟁률", "자기소개서", "추천서", "계좌인증", "2단계", "불합격", "성적산출"],
      ["4년제", "○", "○", "○", "○", "△", "○", "X", "○"],
    ];
    const sheet = makeSheet(rows);
    const { 원서접수 } = parsePricingSheet(sheet);
    const titles = 원서접수.map((s) => s.title);
    expect(titles).toContain("서비스 제공 기준");
    const sec = 원서접수.find((s) => s.title === "서비스 제공 기준")!;
    // 본문 행에 "4년제"가 col 0에 위치 — 단일 표로 묶임
    expect(sec.rows.some((r) => r[0] === "4년제")).toBe(true);
    // 헤더 row에 col 9 "비고"가 포함
    expect(sec.rows[0]).toContain("비고");
  });

  it("좌측 첫 그룹 '1. 원서접수' 헤더는 섹션 추가 X (카테고리 헤더로만 동작)", () => {
    const sheet = makeSheet([
      ["1. 원서접수"],
      [],
      ["서비스 제공 기준"],
      ["헤더", "값"],
    ]);
    const { 원서접수 } = parsePricingSheet(sheet);
    expect(원서접수).toHaveLength(1);
    expect(원서접수[0].title).toBe("서비스 제공 기준");
  });

  it("우측(col 11~14) '2. PIMS' 헤더로 카테고리 분기 + 헤더만 있는 group은 섹션 추가 X", () => {
    const sheet = makeSheet([
      pad(["", "", "", "", "", "", "", "", "", "", "", "2. PIMS"], 15),
      [],
      pad(["", "", "", "", "", "", "", "", "", "", "", "서비스 제공 기준"], 15),
      pad(["", "", "", "", "", "", "", "", "", "", "", "구분", "기본", "신규구축", "사용료"], 15),
      pad(["", "", "", "", "", "", "", "", "", "", "", "전체사용", "기본", "3500만원", "800만원"], 15),
    ]);
    const { 원서접수, PIMS, 입학상담앱 } = parsePricingSheet(sheet);
    expect(원서접수).toEqual([]);
    expect(입학상담앱).toEqual([]);
    expect(PIMS).toHaveLength(1);
    expect(PIMS[0]).toMatchObject({
      category: "PIMS",
      title: "서비스 제공 기준",
    });
  });

  it("우측 '3. 입학상담앱' 헤더 + 본문 → 입학상담앱 카테고리에 섹션 추가 (제목은 '입학상담앱')", () => {
    const sheet = makeSheet([
      pad(["", "", "", "", "", "", "", "", "", "", "", "3. 입학상담앱"], 15),
      pad(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "VAT 포함"], 15),
      pad(["", "", "", "", "", "", "", "", "", "", "", "구분", "신규구축", "사용료", "비고"], 15),
      pad(["", "", "", "", "", "", "", "", "", "", "", "2/4년제", "1200만원", "600만원", ""], 15),
    ]);
    const { 입학상담앱 } = parsePricingSheet(sheet);
    expect(입학상담앱).toHaveLength(1);
    expect(입학상담앱[0]).toMatchObject({
      category: "입학상담앱",
      title: "입학상담앱",
      subtitle: "VAT 포함",
    });
  });

  it("* 또는 ※ 시작 단독 셀은 notes로 분류", () => {
    const sheet = makeSheet([
      ["섹션"],
      ["헤더", "값1"],
      ["* 별도 비용 없음"],
      ["※ 추가 안내"],
      ["행2", "값2"],
    ]);
    const { 원서접수 } = parsePricingSheet(sheet);
    expect(원서접수[0].notes).toEqual(["* 별도 비용 없음", "※ 추가 안내"]);
    expect(원서접수[0].rows).toEqual([
      ["헤더", "값1"],
      ["행2", "값2"],
    ]);
  });

  it("두 번째 single-cell이 짧으면 subtitle (40자 미만)", () => {
    const sheet = makeSheet([
      ["섹션 제목"],
      ["VAT 포함"],
      ["헤더", "값1"],
    ]);
    const { 원서접수 } = parsePricingSheet(sheet);
    expect(원서접수[0].subtitle).toBe("VAT 포함");
    expect(원서접수[0].rows).toEqual([["헤더", "값1"]]);
  });

  it("trailing 빈 셀은 행에서 제거", () => {
    const sheet = makeSheet([["섹션"], ["A", "B", "", "", ""]]);
    const { 원서접수 } = parsePricingSheet(sheet);
    expect(원서접수[0].rows).toEqual([["A", "B"]]);
  });
});
