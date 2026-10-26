import { describe, expect, it } from "vitest";
import {
  SheetShapeError,
  normalizeHeader,
  parseChecks,
  parseDocs,
  parseNumbers,
  parseSchools,
  parseSmsSender,
  pdfSchoolName,
  pickLatestWorkbook,
  stageOf,
} from "../parse";
import {
  CHECK_HEADER,
  DOCS_HEADER,
  NUMBER_HEADER,
  SCHOOL_HEADER,
  checkRow,
  docsRow,
  numberRow,
  pdf,
  rawSource,
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

describe("pickLatestWorkbook", () => {
  const f = (name: string, lm = "2026-10-17T02:33:20Z") => ({
    id: name,
    name,
    webUrl: "",
    size: 1,
    lastModifiedDateTime: lm,
  });
  it("_YYMMDD.xlsm 중 최신 날짜", () => {
    const r = pickLatestWorkbook([
      f("SMS 발신번호 사전등록 현황_261015.xlsm", "2026-10-20T00:00:00Z"),
      f("SMS 발신번호 사전등록 현황_261017.xlsm"),
      f("03. 학교별 제출 서류"),
    ]);
    expect(r.latest?.name).toBe("SMS 발신번호 사전등록 현황_261017.xlsm");
    expect(r.offRuleFiles).toEqual([]);
  });
  it("규칙 밖 .xlsm 은 고르지 않고 따로 센다", () => {
    const r = pickLatestWorkbook([
      f("SMS 발신번호 사전등록 현황_261017.xlsm"),
      f("SMS 발신번호 사전등록 현황_261017(수정).xlsm"),
    ]);
    expect(r.latest?.name).toBe("SMS 발신번호 사전등록 현황_261017.xlsm");
    expect(r.offRuleFiles).toEqual([
      "SMS 발신번호 사전등록 현황_261017(수정).xlsm",
    ]);
  });
  it("규칙에 맞는 파일이 없으면 null", () => {
    const r = pickLatestWorkbook([f("메모.xlsm"), f("a.pdf")]);
    expect(r.latest).toBeNull();
    expect(r.offRuleFiles).toEqual(["메모.xlsm"]);
  });
});

describe("pdfSchoolName", () => {
  it("괄호 안 학교명 — 이름 속 괄호도", () => {
    expect(
      pdfSchoolName("(가나대학교) SMS 발신용 대학 전화번호 등록 서류.pdf"),
    ).toBe("가나대학교");
    expect(
      pdfSchoolName("((사)가나협회) SMS 발신용 대학 전화번호 등록 서류.pdf"),
    ).toBe("(사)가나협회");
    expect(pdfSchoolName("가나대학교.pdf")).toBeNull();
  });
});

describe("stageOf", () => {
  it("경로로 단계를 판정", () => {
    expect(stageOf("완료/제출완료/접수+PIMS")).toEqual({
      stage: "제출완료",
      sub: "접수+PIMS",
    });
    expect(stageOf("완료/검토완료")).toEqual({ stage: "검토완료", sub: null });
    expect(stageOf("진행 중")).toEqual({ stage: "진행 중", sub: null });
    expect(stageOf("보류")).toEqual({ stage: "기타", sub: null });
  });
});

describe("parseSmsSender", () => {
  const eulji = {
    schools: [
      SCHOOL_HEADER,
      schoolRow(1, "가나대학교"),
      schoolRow(52, "을지가나대학교"),
      schoolRow(91, "을지가나대학교", { 구분: "전문대학" }),
    ],
    docs: [
      DOCS_HEADER,
      docsRow(1, "가나대학교"),
      docsRow(52, "을지가나대학교", { "제출 상태": "모두 제출" }),
      docsRow(91, "을지가나대학교", { 구분: "전문대학" }),
    ],
    numbers: [
      NUMBER_HEADER,
      numberRow(1, "을지가나대학교", "02-0000-0052"),
      numberRow(2, "을지가나대학교", "02-0000-0091", { 구분: "전문대학" }),
    ],
    checks: [CHECK_HEADER],
  };

  it("두 폴더 사본 — 앞선 폴더가 먼저, 둘 다 남는다", () => {
    const d = parseSmsSender(
      rawSource({
        pdfs: [
          pdf("완료/검토완료", "가나대학교", {
            lastModifiedDateTime: "2026-10-20T00:00:00Z",
          }),
          pdf("완료/제출완료/접수", "가나대학교"),
        ],
      }),
    );
    expect(d.schools.find((s) => s.no === 1)!.pdfs.map((p) => p.stage)).toEqual(
      ["제출완료", "검토완료"],
    );
  });
  it("같은 단계는 최근 수정 먼저", () => {
    const d = parseSmsSender(
      rawSource({
        pdfs: [
          pdf("완료/제출완료/접수", "가나대학교", {
            id: "old",
            lastModifiedDateTime: "2026-10-01T00:00:00Z",
          }),
          pdf("완료/제출완료/PIMS", "가나대학교", {
            id: "new",
            lastModifiedDateTime: "2026-10-05T00:00:00Z",
          }),
        ],
      }),
    );
    expect(d.schools[0].pdfs.map((p) => p.sub)).toEqual(["PIMS", "접수"]);
  });
  it("별칭으로 PDF 이름을 맞춘다", () => {
    const d = parseSmsSender(
      rawSource({
        sheets: {
          schools: [SCHOOL_HEADER, schoolRow(1, "건국대학교(서울)")],
          docs: [DOCS_HEADER],
          numbers: [NUMBER_HEADER],
          checks: [CHECK_HEADER],
        },
        pdfs: [pdf("진행 중", "건국대학교 서울캠퍼스")],
      }),
    );
    expect(d.schools[0].pdfs).toHaveLength(1);
    expect(d.unmatchedPdfs).toEqual([]);
  });
  it("맞는 학교가 없는 PDF·규칙 밖 이름은 이름 미대조", () => {
    const d = parseSmsSender(
      rawSource({
        pdfs: [
          pdf("진행 중", "다른대학교"),
          { ...pdf("진행 중", "x"), name: "메모.pdf" },
          { ...pdf("진행 중", "x"), name: "메모.docx" },
        ],
      }),
    );
    expect(d.unmatchedPdfs).toEqual([
      "(다른대학교) SMS 발신용 대학 전화번호 등록 서류.pdf",
      "메모.pdf",
    ]);
  });
  it("PDF 가 없는 학교는 pdfs []", () => {
    const d = parseSmsSender(rawSource({ pdfs: [] }));
    expect(d.schools.every((s) => s.pdfs.length === 0)).toBe(true);
  });
  it("같은 이름 두 학교 행에는 사본이 모두 붙는다", () => {
    const d = parseSmsSender(
      rawSource({
        sheets: eulji,
        pdfs: [pdf("진행 중", "을지가나대학교")],
      }),
    );
    expect(d.schools.find((s) => s.no === 52)!.pdfs).toHaveLength(1);
    expect(d.schools.find((s) => s.no === 91)!.pdfs).toHaveLength(1);
    expect(d.unmatchedPdfs).toEqual([]);
  });
  it("_서류 는 No 로 붙는다 — 같은 이름 두 행", () => {
    const d = parseSmsSender(rawSource({ sheets: eulji }));
    const a = d.schools.find((s) => s.no === 52)!;
    const b = d.schools.find((s) => s.no === 91)!;
    expect(a.docs?.completeness).toBe("완비");
    expect(b.docs?.completeness).toBe("미비");
  });
  it("_서류 행이 없는 학교는 docs null", () => {
    const d = parseSmsSender(
      rawSource({
        sheets: { ...eulji, docs: [DOCS_HEADER, docsRow(1, "가나대학교")] },
      }),
    );
    expect(d.schools.find((s) => s.no === 52)!.docs).toBeNull();
  });
  it("발신번호는 학교명+구분으로 붙는다", () => {
    const d = parseSmsSender(rawSource({ sheets: eulji }));
    expect(d.numbers.find((n) => n.number === "02-0000-0091")!.schoolNo).toBe(
      91,
    );
    expect(d.numbers.find((n) => n.number === "02-0000-0052")!.schoolNo).toBe(
      52,
    );
  });
  it("확인 대상 첫 줄로 학교를 잇는다", () => {
    const d = parseSmsSender(
      rawSource({
        sheets: {
          ...eulji,
          checks: [
            CHECK_HEADER,
            checkRow(1, "번호 확인", "가나대학교\n02-0000-0001"),
            checkRow(2, "번호 확인", "가나대학교 (PIMS)"),
            checkRow(3, "번호 확인", "세종 리스트 없음"),
            checkRow(4, "번호 확인", "을지가나대학교"),
          ],
        },
      }),
    );
    expect(d.checks.map((c) => c.schoolNo)).toEqual([1, 1, null, null]);
  });
  it("확인 건수는 _확인 행 수", () => {
    const d = parseSmsSender(
      rawSource({
        sheets: {
          ...eulji,
          checks: [
            CHECK_HEADER,
            checkRow(1, "a", "가나대학교"),
            checkRow(2, "a", "가나대학교"),
            checkRow(3, "a", "가나대학교"),
          ],
        },
      }),
    );
    expect(d.checks).toHaveLength(3);
  });
  it("05 시트 — 없으면 null, 있으면 빈 줄 뺀 문자열 표", () => {
    expect(parseSmsSender(rawSource({ criteria: null })).criteria).toBeNull();
    const d = parseSmsSender(
      rawSource({
        criteria: [
          ["제목", "", ""],
          ["", "", ""],
          ["No", "서류", 1],
        ],
      }),
    );
    expect(d.criteria).toEqual([["제목"], ["No", "서류", "1"]]);
  });
});
