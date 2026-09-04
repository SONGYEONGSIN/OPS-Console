import { describe, it, expect } from "vitest";
import { buildSpecPrompt } from "../lib/dev-control-lib.mjs";

/**
 * 학교 담당자용 명세 프롬프트.
 *
 * 분석 프롬프트(buildClaudePrompt)와 **정반대 목적**이다 — 그쪽은 "제어 요약은
 * 쓰지 말 것"이고, 이쪽은 제어를 빠짐없이 쓰되 비개발자 언어로 쓴다.
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

  it("비개발자 언어를 지시한다", () => {
    expect(p).toContain("비개발자");
    expect(p).toContain("지원자");
  });

  it("코드·파일명·변수명을 쓰지 말라고 못박는다", () => {
    for (const word of ["변수명", "파일명", "코드"]) expect(p).toContain(word);
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
