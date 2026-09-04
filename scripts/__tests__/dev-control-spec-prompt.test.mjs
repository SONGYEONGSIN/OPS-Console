import { describe, it, expect } from "vitest";
import { buildSpecPrompt } from "../lib/dev-control-lib.mjs";

/**
 * 학교 담당자용 명세 프롬프트.
 *
 * 분석 프롬프트(buildClaudePrompt)와 **정반대 목적**이다 — 그쪽은 운영자가
 * 확인할 것만 뽑느라 "제어 요약은 쓰지 말 것"이고, 이쪽은 걸려 있는 제어를
 * 빠짐없이 쓴다.
 *
 * **지원자 안내문이 아니라 설정 명세다.** 처음엔 "지원자가 겪는 일로 서술하라"
 * 였는데, 그 지시가 조건값을 통째로 지워 버렸다 — 실측(service 1130058)에서
 * 코드에 15회 나오는 NEIS 코드 조건이 문서엔 1회만 남고, 고교 지역 코드는
 * 0회였다. 담당자가 대조할 대상이 바로 그 값인데 "특정 고교"로 뭉개졌다.
 */
describe("buildSpecPrompt", () => {
  const p = buildSpecPrompt([
    { kind: "A", code: "function chkBirth(){}" },
    { kind: "AU", code: "var payClose=2;" },
  ]);

  it("두 파일의 코드를 모두 담는다 — 학교는 A/AU 를 구분해 묻지 않는다", () => {
    expect(p).toContain("chkBirth");
    expect(p).toContain("payClose");
  });

  it("A/AU 구분을 드러내지 말라고 지시한다", () => {
    expect(p).toMatch(/A\.js|AU\.js/);
    expect(p).toContain("드러내지");
  });

  it("독자가 입학처 담당자임을 밝힌다", () => {
    expect(p).toContain("입학처");
  });

  it("지원자 안내문으로 쓰지 말라고 못박는다 — 설정 명세다", () => {
    expect(p).toContain("지원자 안내");
    expect(p).toContain("설정 명세");
  });

  it("조건과 결과를 짝으로 쓰게 한다", () => {
    expect(p).toMatch(/조건.*결과|어떤 값일 때/);
  });

  /**
   * 값을 지우면 대조할 수 없는 문서가 된다. 실측에서 이 지시가 없어
   * NEIS 코드 목록이 "특정 고교"로 뭉개졌다.
   */
  it("실제 설정값을 드러내라고 지시한다", () => {
    expect(p).toContain("설정값");
    expect(p).toMatch(/반드시|드러낸다/);
  });

  it("코드 목록을 생략하지 말라고 못박는다 — 대조 대상이 그 목록이다", () => {
    expect(p).toContain("NEISCODE");
    expect(p).toContain("생략하지");
    expect(p).toMatch(/목록 전체|전부/);
  });

  it("뭉뚱그린 표현을 금지한다", () => {
    expect(p).toContain("뭉뚱그린");
  });

  it("전형 단위로 묶게 한다", () => {
    expect(p).toContain("전형 단위");
  });

  /** 이름을 지어내면 담당자가 자기 전형을 못 찾는다. */
  it("전형 이름은 코드 안 설명에서 가져오게 한다 — 지어내지 말 것", () => {
    expect(p).toContain("지어내지");
    expect(p).toContain("desc");
  });

  it("변수명·코드 조각은 여전히 금지한다", () => {
    for (const word of ["변수명", "코드 조각"]) expect(p).toContain(word);
  });

  /** 비어 있는 설정도 담당자가 확인할 대상이다. */
  it("미설정도 담게 한다", () => {
    expect(p).toMatch(/비어 있는|미등록/);
  });

  it("key 가 재생성해도 같아야 한다고 지시한다 — 제외 결정이 걸려 있다", () => {
    expect(p).toContain("key");
    expect(p).toMatch(/동일|같아야/);
  });

  it("items JSON 만 내놓게 한다", () => {
    expect(p).toContain('"items"');
    expect(p).toContain("title");
    expect(p).toContain("body");
  });

  it("빈 목록은 만들지 않는다 — 제어가 없다는 문서는 학교에 쓸모가 없다", () => {
    expect(p).toMatch(/빠짐없이|모두|전부/);
  });
});

/**
 * 명세 응답 파서.
 *
 * `parseClaudeJson` 은 분석 전용이라 `summary_md` + `flags` 를 요구한다 —
 * 명세 응답(`items`)을 넣으면 "형식 불일치"로 죽는다(2026-09-04 실행에서 겪었다).
 */
describe("parseSpecJson", () => {
  it("items 를 뽑는다", async () => {
    const { parseSpecJson } = await import("../lib/dev-control-lib.mjs");
    const out = parseSpecJson('{"items":[{"key":"a","title":"제목","body":"설명"}]}');
    expect(out.items[0].key).toBe("a");
  });

  it("코드펜스에 싸여 와도 뽑는다 — 모델이 자주 감싼다", async () => {
    const { parseSpecJson } = await import("../lib/dev-control-lib.mjs");
    const out = parseSpecJson('설명\n```json\n{"items":[{"key":"a","title":"t","body":"b"}]}\n```\n');
    expect(out.items).toHaveLength(1);
  });

  it("items 가 없으면 던진다 — 빈 문서를 조용히 만들지 않는다", async () => {
    const { parseSpecJson } = await import("../lib/dev-control-lib.mjs");
    expect(() => parseSpecJson('{"summary_md":"x","flags":[]}')).toThrow(/items/);
  });
});
