import { describe, it, expect } from "vitest";
import { parseAdmissionTypes } from "../admission-type-parse";

/**
 * 전형 이름표 붙여넣기 파서.
 *
 * 원서제어 코드에는 **`SelTypeCode` 와 전형 이름이 이어진 자리가 없다**(실측:
 * 같은 줄에 있는 건 1~18 나열 한 줄뿐). 그래서 명세서가 `전형 코드 5` 로만
 * 적혔다. 대학이 주는 접수 현황 자료에는 그 대응이 들어 있어, 그걸 붙여넣는다.
 *
 * 자료는 **지원자 한 명이 한 줄**이라 같은 전형이 수십 줄로 온다 — 합친다.
 * 수험번호·아이디 같은 개인정보 칸은 **읽지 않는다.**
 */
describe("parseAdmissionTypes", () => {
  const header = "수험번호,SelTypeCode,U코드,전형명,모집단위,아이디";

  it("전형 대응을 뽑는다", () => {
    const r = parseAdmissionTypes(
      [header, "1046001,5,1E,학생부교과(사회통합전형),라이프케어,ju1"].join("\n"),
    );
    expect(r.rows).toEqual([
      { selTypeCode: 5, univCode: "1E", name: "학생부교과(사회통합전형)" },
    ]);
  });

  /** 지원자 한 명이 한 줄이라 같은 전형이 수십 번 온다. */
  it("같은 전형은 한 줄로 합친다", () => {
    const r = parseAdmissionTypes(
      [
        header,
        "1,5,1E,학생부교과(사회통합전형),가,a",
        "2,5,1E,학생부교과(사회통합전형),나,b",
      ].join("\n"),
    );
    expect(r.rows).toHaveLength(1);
  });

  it("코드 순으로 돌려준다 — 매번 순서가 바뀌면 대조가 어렵다", () => {
    const r = parseAdmissionTypes(
      [header, "1,15,1G,실기,가,a", "2,5,1E,사회통합,나,b"].join("\n"),
    );
    expect(r.rows.map((x) => x.selTypeCode)).toEqual([5, 15]);
  });

  /** 엑셀이 코드를 수식으로 내보낸다 — `=01` 형태로 온다. */
  it("엑셀이 붙인 등호를 뗀다", () => {
    const r = parseAdmissionTypes(
      [header, "1,1,=01,학생부교과(일반전형),가,a"].join("\n"),
    );
    expect(r.rows[0].univCode).toBe("01");
  });

  /** 모집단위에 따옴표로 감싼 쉼표가 들어 있다. */
  it("따옴표 안의 쉼표를 칸 구분으로 보지 않는다", () => {
    const r = parseAdmissionTypes(
      [header, '1,5,1E,학생부교과(사회통합전형),"라이프케어 ,[3004]",a'].join("\n"),
    );
    expect(r.rows[0].name).toBe("학생부교과(사회통합전형)");
  });

  it("탭 구분도 받는다 — 엑셀에서 바로 복사하면 탭이다", () => {
    const r = parseAdmissionTypes(
      ["수험번호\tSelTypeCode\tU코드\t전형명", "1\t5\t1E\t사회통합"].join("\n"),
    );
    expect(r.rows[0].selTypeCode).toBe(5);
  });

  it("헤더가 없으면 무엇이 빠졌는지 말한다", () => {
    const r = parseAdmissionTypes("가,나,다\n1,2,3");
    expect(r.headerError).toMatch(/SelTypeCode|전형명/);
    expect(r.rows).toEqual([]);
  });

  /** 코드가 숫자가 아니면 이름표가 엉뚱한 전형에 붙는다. */
  it("코드가 숫자가 아닌 행은 버린다", () => {
    const r = parseAdmissionTypes([header, "1,없음,1E,사회통합,가,a"].join("\n"));
    expect(r.rows).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it("빈 입력이면 빈 결과", () => {
    expect(parseAdmissionTypes("").rows).toEqual([]);
  });
});
