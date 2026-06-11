import { describe, it, expect } from "vitest";
import { normalizeName } from "../normalize";
import { isNameMatchStrong } from "../similarity";
import fixture from "./fixtures/gas-cases.json";

type NormalizeCase = { name: string; input: string; expected: string };

const cases = fixture.normalize as NormalizeCase[];

describe("normalizeName — GAS normalizeName_ 1:1 포팅", () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(normalizeName(c.input)).toBe(c.expected);
    });
  }
});

describe("normalizeName — extraAliases (런타임 학습 alias)", () => {
  it("extraAliases 미지정 시 기존 동작과 동일", () => {
    expect(normalizeName("서강국제대학원")).toBe(
      normalizeName("서강국제대학원", {}),
    );
  });

  it("extraAliases가 SPECIAL_MAP처럼 정규화 전 적용된다", () => {
    // 승인 학습: '서강국제대학원' → '서강대'
    expect(normalizeName("서강국제대학원", { 서강국제대학원: "서강대" })).toBe(
      "서강대",
    );
    // 같은 키가 미수 거래처 '서강대학교' 정규화 결과와 일치 → 강매칭 성립
    expect(normalizeName("서강대학교")).toBe("서강대");
  });

  it("extraAliases는 공백 제거 후 매칭", () => {
    expect(
      normalizeName("서강 국제 대학원", { 서강국제대학원: "서강대" }),
    ).toBe("서강대");
  });
});

describe("SPECIAL_MAP — 운영 발견 alias", () => {
  // 입금 거래내용 '국제관광대학원'은 한양대학교 산하 대학원 → 한양대로 매핑.
  it("국제관광대학원 → 한양대", () => {
    expect(normalizeName("국제관광대학원")).toBe("한양대");
  });

  it("국제관광대학원 입금이 한양대학교 미수와 강매칭된다", () => {
    expect(isNameMatchStrong("한양대학교", "국제관광대학원")).toBe(true);
  });

  // 입금 거래내용 '한양인공지능융'(은행 표기 절단)도 한양대학교 산하 → 한양대.
  it("한양인공지능융 → 한양대", () => {
    expect(normalizeName("한양인공지능융")).toBe("한양대");
  });

  it("한양인공지능융 입금이 한양대학교 미수와 강매칭된다", () => {
    expect(isNameMatchStrong("한양대학교", "한양인공지능융")).toBe(true);
  });

  // 입금 거래내용 '부동산융합대학'(한양대 부동산융합대학원)도 한양대.
  it("부동산융합대학 → 한양대", () => {
    expect(normalizeName("부동산융합대학")).toBe("한양대");
  });

  it("부동산융합대학 입금이 한양대학교 미수와 강매칭된다", () => {
    expect(isNameMatchStrong("한양대학교", "부동산융합대학")).toBe(true);
  });
});
