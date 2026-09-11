import { describe, it, expect } from "vitest";
import { extractSmsCode } from "../extract-code";

/**
 * 폰이 보내는 것은 문자 **원문**이다. 인증문자인지, 코드가 무엇인지를 여기서 가른다.
 * null 이면 인증문자가 아니다 — 저장하지 않는다.
 */
describe("extractSmsCode", () => {
  it("Moa 실문자에서 코드를 뽑는다 — 앞의 [Web발신][내부관리자] 는 숫자가 아니다", () => {
    expect(
      extractSmsCode(
        "[Web발신][내부관리자] 본인확인 인증번호는 [130753] 입니다.",
      ),
    ).toBe("130753");
  });

  it("'인증 번호' 처럼 띄어 써도, 조사가 없어도 인증문자다", () => {
    expect(extractSmsCode("인증 번호 [123456]")).toBe("123456");
    expect(extractSmsCode("인증번호[123456]")).toBe("123456");
  });

  it("코드는 '인증번호' 바로 뒤의 것만 — 앞에 놓인 [2026] 을 코드로 오인하면 캡차 잠금이다", () => {
    expect(
      extractSmsCode("[2026] 신년 이벤트 인증번호는 [130753] 입니다."),
    ).toBe("130753");
  });

  it("앞의 짧은 숫자 대괄호가 코드를 가리지 않는다", () => {
    expect(extractSmsCode("[Web발신][12] 인증번호는 [130753] 입니다.")).toBe(
      "130753",
    );
  });

  it("'인증번호' 와 대괄호 사이에 다른 말이 끼면 코드가 아니다 — 스팸의 [9999] 가 앉으면 안 된다", () => {
    expect(extractSmsCode("[광고] 인증번호 이벤트 [9999] 당첨!")).toBeNull();
    expect(extractSmsCode("고객님 인증번호 문의는 [1588] 로")).toBeNull();
  });

  it("인증번호 뒤에 코드가 없으면 앞의 숫자 대괄호로 채우지 않는다", () => {
    expect(extractSmsCode("[2026] 인증번호 안내입니다")).toBeNull();
  });

  it("인증번호 문구가 없으면 대괄호 숫자가 있어도 null", () => {
    expect(extractSmsCode("[Web발신] 2026 신년 할인 [2026]원")).toBeNull();
  });

  it("인증번호 문구가 있어도 대괄호 숫자가 없으면 null — 전화번호를 코드로 보지 않는다", () => {
    expect(extractSmsCode("인증번호 문의 010-1234-5678")).toBeNull();
  });

  it("대괄호 안이 4~8자리 밖이면 null", () => {
    expect(extractSmsCode("인증번호는 [123] 입니다")).toBeNull();
    expect(extractSmsCode("인증번호는 [123456789] 입니다")).toBeNull();
  });

  it("빈 문자열은 null", () => {
    expect(extractSmsCode("")).toBeNull();
  });
});
