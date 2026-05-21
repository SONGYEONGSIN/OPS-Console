import { describe, it, expect } from "vitest";
import {
  parseBaejungList,
  parseSimpleSheet,
  parsePims,
  joinByUniversity,
} from "../parse";
import type { AssignmentSheet, AssignmentRecord } from "../schemas";

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

  it("sub-type 컬럼 순서가 바뀌어도 r1 헤더 기준 '수시'를 대표값으로", () => {
    const shifted: AssignmentSheet = {
      worksheetName: "02. 배정리스트",
      rowsText: [
        mergeRows(cell(3, "대학명"), cell(12, "2027학년도 운영자"), cell(18, "2027학년도 개발자")),
        // 2027 운영 블록 r1: 수시를 offset 2 (col 14)에 배치 (재외/정시/수시/...)
        mergeRows(
          cell(12, "재외"), cell(13, "정시"), cell(14, "수시"), cell(15, "편입"), cell(16, "외국인"), cell(17, "백업"),
          cell(18, "재외"), cell(19, "정시"), cell(20, "수시"), cell(21, "편입"), cell(22, "외국인"), cell(23, "백업"),
        ),
        // 데이터: 수시 운영=col14="박수시", 정시 운영=col13="이정시", 수시 개발=col20="김개발"
        mergeRows(cell(3, "테스트대"), cell(13, "이정시"), cell(14, "박수시"), cell(20, "김개발")),
      ],
      rowCount: 3,
      columnCount: 36,
    };
    const recs = parseBaejungList(shifted);
    expect(recs[0].operator).toBe("박수시");   // col14, r1="수시"
    expect(recs[0].developer).toBe("김개발");  // col20, r1="수시"
    expect(recs[0].detail.find((d) => d.label === "2027 정시 운영")?.value).toBe("이정시");
  });
});

function simpleSheet(headers: string[], dataRows: string[][]): AssignmentSheet {
  return {
    worksheetName: "t",
    rowsText: [headers, ...dataRows],
    rowCount: dataRows.length + 1,
    columnCount: headers.length,
  };
}

describe("parseSimpleSheet", () => {
  it("03.대학원 운영(H)/개발(I) 추출", () => {
    const s = simpleSheet(
      ["No", "대학명", "UnivId", "서비스 구분", "서비스여부", "서비스 개수", "담당자 변경", "운영자", "개발자"],
      [["1", "한국체육대학교", "1153", "대학원", "Y", "3", "변경 X", "기자의", "권용철"]],
    );
    const recs = parseSimpleSheet(s, "대학원", { op: /^운영자$/, dev: /^개발자$/, uni: /대학명/ });
    expect(recs[0]).toMatchObject({
      university: "한국체육대학교", service: "대학원", operator: "기자의", developer: "권용철",
    });
  });

  it("07.상담앱 학교명/운영(F)/개발(G)", () => {
    const s = simpleSheet(
      ["UnivID", "학교명", "ServiceID", "접수운영", "영업자", "운영자", "개발자"],
      [["1187", "신한대학교", "x", "김지현", "김은호", "기자의", "박형진"]],
    );
    const recs = parseSimpleSheet(s, "상담앱", { op: /^운영자$/, dev: /^개발자$/, uni: /학교명|대학명/ });
    expect(recs[0]).toMatchObject({ university: "신한대학교", operator: "기자의", developer: "박형진" });
  });
});

describe("parsePims", () => {
  it("운영자 FULL(G) 대표 + 개발자 없음 + 환/충 detail", () => {
    const s = simpleSheet(
      ["No", "대분류", "지역", "대학명", "서비스구분", "담당자 변경", "운영자 FULL", "접수운영자", "운영자 환/충"],
      [["1", "4년제", "서울", "서경대학교", "Full", "변경 X", "기자의", "임종우", "기존충원"]],
    );
    const recs = parsePims(s);
    expect(recs[0]).toMatchObject({
      university: "서경대학교", service: "PIMS", operator: "기자의", developer: "",
    });
    expect(recs[0].detail.find((d) => d.label === "운영자 환/충")?.value).toBe("기존충원");
  });
});

describe("parseBaejungList subtypes", () => {
  // 시트 픽스처: 2027 운영(M=12) 수시+정시 / 2027 개발(S=18) 수시+정시 / 2026 운영(Y=24) 수시
  const subtypeSheet: AssignmentSheet = {
    worksheetName: "02. 배정리스트",
    rowsText: [
      // r0: 블록 헤더
      mergeRows(
        cell(3, "대학명"),
        cell(12, "2027학년도 운영자"),
        cell(18, "2027학년도 개발자"),
        cell(24, "2026학년도 운영자"),
      ),
      // r1: sub-type 라벨 (재외/수시/정시/편입/외국인/백업 순)
      mergeRows(
        cell(12, "재외"), cell(13, "수시"), cell(14, "정시"), cell(15, "편입"), cell(16, "외국인"), cell(17, "백업"),
        cell(18, "재외"), cell(19, "수시"), cell(20, "정시"), cell(21, "편입"), cell(22, "외국인"), cell(23, "백업"),
        cell(24, "재외"), cell(25, "수시"), cell(26, "정시"), cell(27, "편입"), cell(28, "외국인"), cell(29, "백업"),
      ),
      // r2: 한국대학교 데이터 — 2027 수시 운영(13)="A운영", 2027 정시 운영(14)="B운영",
      //   2027 수시 개발(19)="A개발", 2027 정시 개발(20)="B개발", 2026 수시 운영(25)="구운영"
      //   재외(12)는 빈 문자열 → subtypes에 포함 안 됨
      mergeRows(
        cell(3, "한국대학교"),
        cell(13, "A운영"), cell(14, "B운영"),
        cell(19, "A개발"), cell(20, "B개발"),
        cell(25, "구운영"),
      ),
    ],
    rowCount: 3,
    columnCount: 36,
  };

  it("2027 하위유형(수시/정시)이 데이터 있을 때만 subtypes에 포함 (재외 빈값 제외)", () => {
    const recs = parseBaejungList(subtypeSheet);
    expect(recs).toHaveLength(1);
    const subtypes = recs[0].subtypes;
    expect(subtypes).toBeDefined();
    // 수시, 정시만 — 재외/편입/외국인/백업은 빈값이므로 제외
    expect(subtypes).toHaveLength(2);
    expect(subtypes![0].label).toBe("수시");
    expect(subtypes![0].operator).toBe("A운영");
    expect(subtypes![0].developer).toBe("A개발");
    expect(subtypes![1].label).toBe("정시");
    expect(subtypes![1].operator).toBe("B운영");
    expect(subtypes![1].developer).toBe("B개발");
  });

  it("subtypes는 2027 데이터만 포함 (2026 구운영은 제외)", () => {
    const recs = parseBaejungList(subtypeSheet);
    const subtypes = recs[0].subtypes ?? [];
    const labels = subtypes.map((s) => s.label);
    // 2026 수시 "구운영"이 subtypes에 들어가면 안 됨
    expect(labels).not.toContain("2026 수시");
    // 값도 포함 안 돼야 함
    expect(subtypes.every((s) => s.operator !== "구운영")).toBe(true);
  });

  it("2027 운영은 있고 개발 없는 sub-type도 subtypes에 포함", () => {
    const onlyOpSheet: AssignmentSheet = {
      worksheetName: "02. 배정리스트",
      rowsText: [
        mergeRows(cell(3, "대학명"), cell(12, "2027학년도 운영자"), cell(18, "2027학년도 개발자")),
        mergeRows(
          cell(12, "재외"), cell(13, "수시"), cell(14, "정시"), cell(15, "편입"), cell(16, "외국인"), cell(17, "백업"),
          cell(18, "재외"), cell(19, "수시"), cell(20, "정시"), cell(21, "편입"), cell(22, "외국인"), cell(23, "백업"),
        ),
        // 운영 수시만 있고 개발 수시 없음
        mergeRows(cell(3, "테스트대"), cell(13, "X운영")),
      ],
      rowCount: 3,
      columnCount: 36,
    };
    const recs = parseBaejungList(onlyOpSheet);
    const subtypes = recs[0].subtypes ?? [];
    expect(subtypes).toHaveLength(1);
    expect(subtypes[0].label).toBe("수시");
    expect(subtypes[0].operator).toBe("X운영");
    expect(subtypes[0].developer).toBe("");
  });

  it("subtypes 컬럼 순서 = 시트 컬럼 순서 (재외/수시/정시/...)", () => {
    const recs = parseBaejungList(subtypeSheet);
    const labels = (recs[0].subtypes ?? []).map((s) => s.label);
    // 시트 순서: 재외(없음) → 수시 → 정시
    expect(labels).toEqual(["수시", "정시"]);
  });
});

describe("joinByUniversity", () => {
  const recs: AssignmentRecord[] = [
    { university: "고려대학교", service: "원서접수", operator: "김슬기", developer: "박형진", detail: [] },
    { university: "고려대학교", service: "대학원", operator: "기자의", developer: "권용철", detail: [] },
    { university: "연세대학교", service: "PIMS", operator: "한효진", developer: "", detail: [] },
  ];
  it("대학명 기준으로 서비스 묶음 생성", () => {
    const rows = joinByUniversity(recs);
    const korea = rows.find((r) => r.university === "고려대학교");
    expect(korea?.byService["원서접수"]?.operator).toBe("김슬기");
    expect(korea?.byService["대학원"]?.operator).toBe("기자의");
    expect(korea?.byService["PIMS"]).toBeUndefined();
    expect(rows).toHaveLength(2);
  });
  it("대학명 가나다 정렬", () => {
    const rows = joinByUniversity(recs);
    expect(rows[0].university).toBe("고려대학교");
    expect(rows[1].university).toBe("연세대학교");
  });
});
