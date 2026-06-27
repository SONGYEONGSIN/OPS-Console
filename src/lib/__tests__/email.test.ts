import { describe, it, expect } from "vitest";
import { isValidEmail, parseEmailList } from "../email";

describe("isValidEmail", () => {
  it("정상 이메일은 true", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("school@univ.ac.kr")).toBe(true);
  });
  it("이름/빈값/형식오류는 false", () => {
    expect(isValidEmail("진학어플라이")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("parseEmailList", () => {
  it("콤마·세미콜론·줄바꿈·공백 구분 + 검증 + 중복제거", () => {
    const r = parseEmailList("a@b.com, a@b.com; ext@x.com\n이름");
    expect(r.emails).toEqual(["a@b.com", "ext@x.com"]);
    expect(r.invalid).toEqual(["이름"]);
  });
  it("빈 입력은 빈 결과", () => {
    expect(parseEmailList("")).toEqual({ emails: [], invalid: [] });
  });
});
