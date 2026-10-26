import { describe, expect, it } from "vitest";
import {
  NUMBER_STATUS_ORDER,
  filterChecks,
  filterNumbers,
  filterSchools,
  gubunCards,
  matchesNumberQuery,
  orderedOptions,
  pageSlice,
  parseNumberFilters,
  parseSchoolFilters,
  schoolDetail,
  stageLabel,
  type SchoolFilters,
} from "../filters";
import { parseSmsSender } from "../parse";
import type { PdfCopy, School } from "../types";
import {
  SCHOOL_HEADER,
  checkRow,
  numberRow,
  rawSource,
  schoolRow,
} from "./fixtures";

const data = () => parseSmsSender(rawSource());

const pdfCopy = (stage: PdfCopy["stage"], sub: string | null): PdfCopy => ({
  fileName: "x.pdf",
  folder: "x",
  stage,
  sub,
  webUrl: "https://example.invalid/x",
  lastModifiedDateTime: "2026-10-19T00:47:30Z",
});

const base = (): School => data().schools[0];
const withPdfs = (s: School, pdfs: PdfCopy[]): School => ({ ...s, pdfs });

const noFilter: SchoolFilters = {
  q: "",
  gubun: "",
  stage: "",
  docs: "",
  checkOnly: false,
  school: null,
};

describe("parseSchoolFilters", () => {
  it("공백 정리·모르는 값은 비움", () => {
    expect(
      parseSchoolFilters({
        q: " 가나 ",
        gubun: "4년제",
        stage: "PIMS",
        docs: "미비",
        check: "1",
        school: "3",
      }),
    ).toEqual({
      q: "가나",
      gubun: "4년제",
      stage: "PIMS",
      docs: "미비",
      checkOnly: true,
      school: 3,
    });
    expect(
      parseSchoolFilters({ docs: "아무거나", school: "abc" }),
    ).toMatchObject({ docs: "", school: null });
    expect(parseSchoolFilters({})).toEqual(noFilter);
  });
});

describe("stageLabel", () => {
  it("단계별 표기", () => {
    const s = base();
    expect(stageLabel(withPdfs(s, []))).toBe("PDF 없음");
    expect(stageLabel(withPdfs(s, [pdfCopy("제출완료", "접수+PIMS")]))).toBe(
      "접수+PIMS",
    );
    expect(stageLabel(withPdfs(s, [pdfCopy("제출완료", null)]))).toBe(
      "제출완료",
    );
    expect(stageLabel(withPdfs(s, [pdfCopy("검토완료", null)]))).toBe(
      "검토완료",
    );
    expect(stageLabel(withPdfs(s, [pdfCopy("진행 중", null)]))).toBe("진행 중");
    expect(stageLabel(withPdfs(s, [pdfCopy("기타", null)]))).toBe("기타 폴더");
  });
});

describe("filterSchools", () => {
  it("이름 검색은 공백 무시", () => {
    const { schools } = data();
    expect(
      filterSchools(schools, { ...noFilter, q: "가나 대학교" }).map(
        (s) => s.name,
      ),
    ).toEqual(["가나대학교"]);
    expect(filterSchools(schools, { ...noFilter, q: "" })).toHaveLength(3);
  });

  it("단계·서류·확인만", () => {
    const [a, b, c] = data().schools;
    const schools: School[] = [
      withPdfs(a, []),
      { ...withPdfs(b, [pdfCopy("검토완료", null)]), docs: null },
      { ...withPdfs(c, [pdfCopy("제출완료", "PIMS")]), needsCheck: true },
    ];
    expect(
      filterSchools(schools, { ...noFilter, stage: "PDF 없음" }).map(
        (s) => s.no,
      ),
    ).toEqual([a.no]);
    expect(
      filterSchools(schools, { ...noFilter, stage: "PIMS" }).map((s) => s.no),
    ).toEqual([c.no]);
    expect(
      filterSchools(schools, { ...noFilter, docs: "확인 안 됨" }).map(
        (s) => s.no,
      ),
    ).toEqual([b.no]);
    expect(
      filterSchools(schools, { ...noFilter, checkOnly: true }).map((s) => s.no),
    ).toEqual([c.no]);
  });

  it("구분: 기타는 목록 밖 구분 전체, 입력은 바꾸지 않는다", () => {
    const [a, b, c] = data().schools;
    const schools: School[] = [a, { ...b, gubun: "특수" }, c];
    const copy = [...schools];
    expect(
      filterSchools(schools, { ...noFilter, gubun: "기타" }).map((s) => s.no),
    ).toEqual([b.no]);
    expect(
      filterSchools(schools, { ...noFilter, gubun: "4년제" }).map((s) => s.no),
    ).toEqual([a.no]);
    expect(schools).toEqual(copy);
  });
});

describe("gubunCards", () => {
  it("4장 고정 + 있을 때만 기타", () => {
    const raw = rawSource();
    raw.sheets.schools = [
      SCHOOL_HEADER,
      schoolRow(1, "가나대학교", { "등록 회선": 2, "서류 미비": 0, 확인: "O" }),
      schoolRow(2, "다라대학교", { "등록 회선": 3, "서류 미비": 1 }),
      schoolRow(3, "특수학교", { 구분: "특수" }),
    ];
    const parsed = parseSmsSender(raw).schools;
    const cards = gubunCards(parsed);
    expect(cards).toHaveLength(5);
    expect(cards.map((c) => c.gubun)).toEqual([
      "4년제",
      "전문대학",
      "대학원",
      "초중고",
      "기타",
    ]);
    expect(cards[0]).toEqual({
      gubun: "4년제",
      schools: 2,
      lines: parsed[0].lines + parsed[1].lines,
      deficient: parsed[0].deficient + parsed[1].deficient,
      checks: parsed.filter((s) => s.gubun === "4년제" && s.needsCheck).length,
    });
    expect(cards[3]).toMatchObject({ gubun: "초중고", schools: 0, lines: 0 });
    expect(cards[4].schools).toBe(1);
    expect(gubunCards(parsed.slice(0, 2))).toHaveLength(4);
  });
});

describe("matchesNumberQuery", () => {
  it("하이픈·공백 무시, 학교명도", () => {
    const n = {
      ...data().numbers[0],
      number: "02-0000-0001",
      digits: "0200000001",
      school: "가나대학교",
    };
    expect(matchesNumberQuery(n, "02-0000-0001")).toBe(true);
    expect(matchesNumberQuery(n, "02 0000-0001")).toBe(true);
    expect(matchesNumberQuery(n, "0000-0001")).toBe(true);
    expect(matchesNumberQuery(n, "가나")).toBe(true);
    expect(matchesNumberQuery(n, "0399")).toBe(false);
    expect(matchesNumberQuery(n, "")).toBe(true);
  });
});

describe("filterNumbers / parseNumberFilters", () => {
  it("상태·구분", () => {
    const raw = rawSource();
    raw.sheets.numbers = [
      raw.sheets.numbers[0],
      numberRow(1, "가나대학교", "02-0000-0001", { 상태: "일괄 등록" }),
      numberRow(2, "다라대학교", "02-0000-0002", { 상태: "추가 등록" }),
      numberRow(3, "마바전문대학", "02-0000-0003", {
        구분: "전문대학",
        상태: "추가 등록",
      }),
    ];
    const { numbers } = parseSmsSender(raw);
    const f = { q: "", status: "", gubun: "", page: 1 };
    expect(filterNumbers(numbers, f)).toHaveLength(3);
    expect(filterNumbers(numbers, { ...f, status: "추가 등록" })).toHaveLength(
      2,
    );
    expect(
      filterNumbers(numbers, {
        ...f,
        status: "추가 등록",
        gubun: "전문대학",
      }).map((n) => n.school),
    ).toEqual(["마바전문대학"]);
    expect(
      filterNumbers(numbers, { ...f, q: "0000-0001" }).map((n) => n.school),
    ).toEqual(["가나대학교"]);
  });

  it("page 는 1 이상 정수", () => {
    expect(parseNumberFilters({ page: "abc" }).page).toBe(1);
    expect(parseNumberFilters({ page: "0" }).page).toBe(1);
    expect(parseNumberFilters({ page: "3" }).page).toBe(3);
    expect(
      parseNumberFilters({ q: " a ", status: "추가 등록", gubun: "4년제" }),
    ).toEqual({
      q: "a",
      status: "추가 등록",
      gubun: "4년제",
      page: 1,
    });
  });
});

describe("pageSlice", () => {
  it("범위 밖 page 는 마지막 페이지", () => {
    const rows = Array.from({ length: 120 }, (_, i) => i);
    expect(pageSlice(rows, 3, 50)).toHaveLength(20);
    expect(pageSlice(rows, 999, 50)).toEqual(pageSlice(rows, 3, 50));
    expect(pageSlice([], 5, 50)).toEqual([]);
  });
});

describe("schoolDetail", () => {
  it("없는 No·null 은 null, 있으면 번호·확인을 schoolNo 로", () => {
    const raw = rawSource();
    raw.sheets.checks = [
      raw.sheets.checks[0],
      checkRow(1, "번호 확인", "가나대학교\n02-0000-0001"),
    ];
    const d = parseSmsSender(raw);
    expect(schoolDetail(d, null)).toBeNull();
    expect(schoolDetail(d, 999)).toBeNull();
    const detail = schoolDetail(d, d.schools[0].no);
    expect(detail?.school.no).toBe(d.schools[0].no);
    expect(detail?.numbers.length).toBeGreaterThan(0);
    expect(detail?.numbers.every((n) => n.schoolNo === d.schools[0].no)).toBe(
      true,
    );
    expect(detail?.checks.every((c) => c.schoolNo === d.schools[0].no)).toBe(
      true,
    );
  });
});

describe("orderedOptions", () => {
  it("선호 순서 먼저, 데이터에만 있는 값은 뒤에", () => {
    expect(
      orderedOptions(
        ["번호 없음", "추가 등록", "일괄 등록", "일괄 등록"],
        NUMBER_STATUS_ORDER,
      ),
    ).toEqual(["일괄 등록", "추가 등록", "서류 미비", "번호 없음"]);
  });
});

describe("filterChecks", () => {
  it("유형", () => {
    const c = data().checks[0];
    const rows = [
      { ...c, kind: "번호 확인" },
      { ...c, kind: "서류 확인" },
    ];
    expect(filterChecks(rows, "서류 확인")).toHaveLength(1);
    expect(filterChecks(rows, "")).toHaveLength(2);
  });
});
