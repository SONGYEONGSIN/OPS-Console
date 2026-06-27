import { describe, it, expect } from "vitest";
import { isValidEmail, collectRecipients } from "../recipients";

describe("isValidEmail", () => {
  it("정상 이메일은 true", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("kim.lee@jinhakapply.com")).toBe(true);
  });
  it("이름/빈값/형식오류는 false", () => {
    expect(isValidEmail("송영신")).toBe(false);
    expect(isValidEmail("수신대표")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("collectRecipients", () => {
  it("운영자 선택 + 자유입력을 합쳐 검증·중복제거한다", () => {
    const r = collectRecipients(
      ["a@b.com", "c@d.com"],
      "c@d.com, ext@x.com\n송영신",
    );
    // a,c,ext 유효(중복 c 제거), 송영신은 invalid
    expect(r.emails).toEqual(["a@b.com", "c@d.com", "ext@x.com"]);
    expect(r.invalid).toEqual(["송영신"]);
  });
  it("콤마·줄바꿈·세미콜론·공백 구분자 모두 처리", () => {
    const r = collectRecipients([], "a@b.com; c@d.com\n e@f.com");
    expect(r.emails).toEqual(["a@b.com", "c@d.com", "e@f.com"]);
    expect(r.invalid).toEqual([]);
  });
  it("빈 입력은 빈 결과", () => {
    expect(collectRecipients([], "")).toEqual({ emails: [], invalid: [] });
  });
});
