import { describe, it, expect } from "vitest";
import {
  DEFAULT_END_MONTH,
  parseEndMonth,
  resolveContractEnd,
} from "../period";

/**
 * 값은 전부 실제 대장에서 뽑은 것이다 (2027학년도 관리대장, 2026-08-24 전수 조회).
 * 4년제 `기간` 16종 44건 + 대학원 `계약기간 (종료일 작성)` 6종 10건.
 * 형식이 사람 손으로 적혀 제각각이라 샘플이 아니라 전수를 박아둔다.
 */
describe("parseEndMonth — 4년제 `기간` 실데이터 16종", () => {
  it("`YYYY년 M월` 형태를 YYYY-MM 으로 읽는다", () => {
    expect(parseEndMonth("~2027년 2월")).toBe("2027-02");
    expect(parseEndMonth("~2028년 2월")).toBe("2028-02");
    expect(parseEndMonth("~2028년 6월")).toBe("2028-06");
    expect(parseEndMonth("~2027년 6월")).toBe("2027-06");
    expect(parseEndMonth("~2027년 8월")).toBe("2027-08");
    expect(parseEndMonth("~2029년 8월")).toBe("2029-08");
    expect(parseEndMonth("~2029년 2월")).toBe("2029-02");
    expect(parseEndMonth("~2026년 12월")).toBe("2026-12");
    expect(parseEndMonth("~2028년 5월")).toBe("2028-05");
  });

  it("물결 뒤 공백이 있어도 같게 읽는다 — 대장에 두 표기가 섞여 있다", () => {
    expect(parseEndMonth("~ 2028년 3월")).toBe("2028-03");
    expect(parseEndMonth("~ 2029년 8월")).toBe("2029-08");
    expect(parseEndMonth("~ 2029년 2월")).toBe("2029-02");
    expect(parseEndMonth("~ 2029년 6월")).toBe("2029-06");
    expect(parseEndMonth("~ 2027년 7월")).toBe("2027-07"); // 조선대학교
  });

  it("월이 없는 학년도 표기는 읽지 않는다 — 2028학년도 후기가 몇 월인지 대장이 말해주지 않는다", () => {
    expect(parseEndMonth("~2028학년도 후기외국인")).toBeNull(); // 덕성여자대학교
    expect(parseEndMonth("~ 2028학년도 후기")).toBeNull(); // 동국대학교(서울)
  });
});

describe("parseEndMonth — 대학원 `계약기간 (종료일 작성)` 실데이터 6종", () => {
  it("점으로 끊은 날짜에서 월까지만 취한다", () => {
    expect(parseEndMonth("2027.02.28")).toBe("2027-02");
    expect(parseEndMonth("2027.04.30")).toBe("2027-04");
    expect(parseEndMonth("2027.08.31")).toBe("2027-08");
    expect(parseEndMonth("2027.09.30")).toBe("2027-09");
  });

  it("물결·공백·끝점이 섞인 표기도 같게 읽는다", () => {
    expect(parseEndMonth("~ 2027. 8. 31.")).toBe("2027-08"); // 숙명여자대학교
    expect(parseEndMonth("~ 2028. 08. 31")).toBe("2028-08"); // 신한대학교
  });
});

describe("parseEndMonth — 읽을 수 없는 입력", () => {
  it("빈 값은 null", () => {
    expect(parseEndMonth("")).toBeNull();
    expect(parseEndMonth("   ")).toBeNull();
  });

  it("달이 범위를 벗어나면 읽지 않는다 — 오타를 그대로 통과시키면 없는 달이 화면에 뜬다", () => {
    expect(parseEndMonth("~2027년 13월")).toBeNull();
    expect(parseEndMonth("2027.00.15")).toBeNull();
  });

  it("연도가 네 자리가 아니면 읽지 않는다", () => {
    expect(parseEndMonth("~27년 2월")).toBeNull();
  });
});

describe("resolveContractEnd — 출처 판정", () => {
  it("대장에 적혀 있으면 그 값을 쓴다", () => {
    expect(resolveContractEnd({ period: "~ 2027년 7월", multiYear: "특이" })).toEqual({
      label: "2027-07",
      kind: "ledger",
    });
  });

  it("빈 칸이고 다년계약 표시도 없으면 학년도 종료로 본다", () => {
    expect(resolveContractEnd({ period: "", multiYear: "" })).toEqual({
      label: DEFAULT_END_MONTH,
      kind: "assumed",
    });
  });

  it("빈 칸인데 다년계약이면 기본값이 틀린 것이므로 확인 대상으로 표시한다", () => {
    // 서울대·부산대·성균관대 등 9건. 다년인데 종료일이 대장에 없다.
    expect(resolveContractEnd({ period: "", multiYear: "특이" })).toEqual({
      label: DEFAULT_END_MONTH,
      kind: "check",
    });
    expect(resolveContractEnd({ period: "", multiYear: "○" })).toEqual({
      label: DEFAULT_END_MONTH,
      kind: "check",
    });
    expect(resolveContractEnd({ period: "", multiYear: "3년" })).toEqual({
      label: DEFAULT_END_MONTH,
      kind: "check",
    });
  });

  it("적혀 있으나 월을 못 읽으면 지어내지 않고 원문을 보여준다", () => {
    expect(
      resolveContractEnd({ period: "~ 2028학년도 후기", multiYear: "○" }),
    ).toEqual({ label: "~ 2028학년도 후기", kind: "raw" });
  });

  it("기간 컬럼이 아예 없는 시트(전문대·초중고·기타)는 빈 칸과 같게 다룬다", () => {
    expect(resolveContractEnd({ period: undefined, multiYear: undefined })).toEqual({
      label: DEFAULT_END_MONTH,
      kind: "assumed",
    });
  });

  it("공백뿐인 다년계약 표시는 표시 없음으로 본다 — 대장에 공백 한 칸이 들어간 행이 있다", () => {
    expect(resolveContractEnd({ period: "", multiYear: "  " })).toEqual({
      label: DEFAULT_END_MONTH,
      kind: "assumed",
    });
  });
});
