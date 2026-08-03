import { describe, it, expect } from "vitest";
import { resolvesViaAlias } from "../normalize";

/**
 * `resolvesViaAlias` — 이름이 SPECIAL_MAP·학습 alias에 걸려 특정 대학으로 '해소'됐는지.
 *
 * mismatch(금액 일치·이름 불일치) 확인 요청에서 쓴다. 해소된 이름은 정체가 이미 밝혀진
 * 것이므로, 미수 거래처와 다르면 표기 변형 후보가 아니라 그냥 다른 대학이다.
 */
describe("resolvesViaAlias", () => {
  it("SPECIAL_MAP 완전일치 키는 해소로 본다", () => {
    expect(resolvesViaAlias("국제관광대학원")).toBe(true);
    expect(resolvesViaAlias("연대")).toBe(true);
  });

  it("SPECIAL_MAP prefix 매칭도 해소로 본다", () => {
    // normalizeName이 prefix 매칭을 쓰므로 동일 규칙이어야 한다.
    expect(resolvesViaAlias("이대학사지원")).toBe(true);
  });

  it("공백은 제거하고 판정한다", () => {
    expect(resolvesViaAlias("국제 관광 대학원")).toBe(true);
  });

  it("맵에 없는 이름은 해소가 아니다", () => {
    expect(resolvesViaAlias("한남대학교")).toBe(false);
    expect(resolvesViaAlias("관동대")).toBe(false);
    expect(resolvesViaAlias("서강국제대학원")).toBe(false);
  });

  it("학습 alias(extraAliases)도 해소로 본다", () => {
    expect(resolvesViaAlias("무슨무슨센터")).toBe(false);
    expect(resolvesViaAlias("무슨무슨센터", { 무슨무슨센터: "한양대" })).toBe(
      true,
    );
  });

  it("빈 값은 해소가 아니다", () => {
    expect(resolvesViaAlias("")).toBe(false);
  });
});
