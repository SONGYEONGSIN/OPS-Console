import { describe, expect, it } from "vitest";
import {
  SheetShapeError,
  normalizeHeader,
  parseChecks,
  parseDocs,
  parseNumbers,
  parseSchools,
} from "../parse";
import {
  CHECK_HEADER,
  DOCS_HEADER,
  NUMBER_HEADER,
  SCHOOL_HEADER,
  checkRow,
  docsRow,
  numberRow,
  schoolRow,
} from "./fixtures";

const insertAt = (row: unknown[], i: number, v: unknown) => [
  ...row.slice(0, i),
  v,
  ...row.slice(i),
];

describe("normalizeHeader", () => {
  it("둘째 줄과 끝 괄호를 버린다", () => {
    expect(normalizeHeader("제출 서류 (10/15 기준)")).toBe("제출 서류");
    expect(normalizeHeader("등록 회선\n(03 번호 목록)")).toBe("등록 회선");
    expect(normalizeHeader("제출 상태\n(10/15 기준)")).toBe("제출 상태");
    expect(normalizeHeader("  학교명 ")).toBe("학교명");
  });
});

describe("parseSchools", () => {
  const expected = {
    no: 1,
    name: "가나대학교",
    gubun: "4년제",
    apply: true,
    pims: false,
    lines: 2,
    bulk: 2,
    added: 0,
    deficient: 0,
    lastRegisteredAt: null,
    docSummary: "1종 미제출 (신분증)",
    needsCheck: false,
    note: "",
  };
  it("헤더 이름으로 읽는다 — 고를 값·담당자는 없다", () => {
    expect(parseSchools([SCHOOL_HEADER, schoolRow(1, "가나대학교")])).toEqual([
      expected,
    ]);
  });
  it("열이 끼어도 같은 값", () => {
    const out = parseSchools([
      insertAt(SCHOOL_HEADER, 3, "메모"),
      insertAt(schoolRow(1, "가나대학교"), 3, "x"),
    ]);
    expect(out).toEqual([expected]);
  });
  it("기준일이 바뀐 헤더도 찾는다", () => {
    const head = SCHOOL_HEADER.map((h) =>
      h.startsWith("제출 서류") ? "제출 서류 (10/30 기준)" : h,
    );
    expect(parseSchools([head, schoolRow(1, "가나대학교")])[0].docSummary).toBe(
      "1종 미제출 (신분증)",
    );
  });
  it("확인 필요 표시", () => {
    expect(
      parseSchools([
        SCHOOL_HEADER,
        schoolRow(1, "가나대학교", { 확인: "확인 필요" }),
      ])[0].needsCheck,
    ).toBe(true);
  });
  it("No 가 빈 줄은 건너뛴다", () => {
    const blank = SCHOOL_HEADER.map(() => "");
    expect(
      parseSchools([SCHOOL_HEADER, blank, schoolRow(1, "가나대학교")]),
    ).toHaveLength(1);
  });
  it("필수 열이 없으면 시트·열을 담은 오류", () => {
    const head = SCHOOL_HEADER.map((h) => (h === "학교명" ? "대학명" : h));
    expect(() => parseSchools([head])).toThrow(
      "‘_학교’ 시트에서 ‘학교명’ 열을 찾지 못했습니다.",
    );
    try {
      parseSchools([head]);
    } catch (e) {
      expect(e).toBeInstanceOf(SheetShapeError);
      expect((e as SheetShapeError).column).toBe("학교명");
    }
  });
  it("빈 시트는 오류", () =>
    expect(() => parseSchools([])).toThrow("‘_학교’ 시트가 비어 있습니다."));
  it("같은 열 이름이 둘이면 오류", () => {
    const head = SCHOOL_HEADER.map((h, i) => (i === 14 ? "비고" : h));
    expect(() => parseSchools([head])).toThrow(
      "‘_학교’ 시트에 ‘비고’ 열이 두 개 있습니다.",
    );
  });
});

describe("parseDocs", () => {
  it("No 로 묶고 8종 표시를 원문 그대로", () => {
    const m = parseDocs([
      DOCS_HEADER,
      docsRow(1, "가나대학교", { 법인인감: "대체", 위탁계약서: "" }),
    ]);
    expect(m.get(1)).toEqual({
      sejongStatus: "등록 완료",
      marks: {
        신청서: "O",
        위임장: "O",
        이용증명원: "O",
        사업자등록증: "O",
        법인인감: "대체",
        재직증명서: "O",
        신분증: "✕",
        위탁계약서: "",
      },
      submitState: "1종 미제출",
      completeness: "미비",
      missing: "신분증",
    });
  });
  it("제출 상태 → 완비/미비/확인 안 됨", () => {
    const of = (s: string) =>
      parseDocs([
        DOCS_HEADER,
        docsRow(1, "가나대학교", { "제출 상태": s }),
      ]).get(1)?.completeness;
    expect(of("모두 제출")).toBe("완비");
    expect(of("3종 미제출")).toBe("미비");
    expect(of("서류 확인 안 됨")).toBe("확인 안 됨");
    expect(of("새 문구")).toBe("확인 안 됨");
  });
});

describe("parseNumbers", () => {
  it("원문과 숫자만 둘 다", () => {
    const [n] = parseNumbers([
      NUMBER_HEADER,
      numberRow(1, "가나대학교", "02-0000-0001", { 등록일자: "2025-10-28" }),
    ]);
    expect(n).toMatchObject({
      number: "02-0000-0001",
      digits: "0200000001",
      status: "일괄 등록",
      registeredAt: "2025-10-28",
    });
  });
  it("등록일자가 엑셀 일련번호여도 날짜로", () => {
    const [n] = parseNumbers([
      NUMBER_HEADER,
      numberRow(1, "가나대학교", "02-0000-0001", { 등록일자: 45958 }),
    ]);
    expect(n.registeredAt).toBe("2025-10-28");
  });
  it("번호 없음 행도 남긴다", () => {
    const out = parseNumbers([
      NUMBER_HEADER,
      numberRow(1, "가나대학교", "-", { 상태: "번호 없음" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].digits).toBe("");
  });
});

describe("parseChecks", () => {
  it("6열을 읽는다 — 상태 열은 없다", () => {
    const out = parseChecks([
      CHECK_HEADER,
      checkRow(1, "번호 확인", "가나대학교\n02-0000-0001", {
        내용: "c",
        근거: "b",
        "할 일": "t",
      }),
    ]);
    expect(out).toEqual([
      {
        no: 1,
        kind: "번호 확인",
        target: "가나대학교\n02-0000-0001",
        content: "c",
        basis: "b",
        todo: "t",
      },
    ]);
  });
});
