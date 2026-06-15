import { describe, it, expect } from "vitest";
import { INSIGHT_CATEGORIES, categoryOf } from "../categories";

describe("categoryOf", () => {
  it("AI 코딩 계열 keyword를 'AI 코딩'으로 묶는다", () => {
    for (const kw of [
      "바이브코딩",
      "Claude Code",
      "클로드 스킬",
      "AI 코딩 에이전트",
      "AgentOS",
    ]) {
      expect(categoryOf(kw)).toBe("AI 코딩");
    }
  });

  it("업무 자동화 계열 keyword를 '업무 자동화'로 묶는다", () => {
    for (const kw of ["AI 업무 자동화", "AI 활용 업무 적용", "AI자동화"]) {
      expect(categoryOf(kw)).toBe("업무 자동화");
    }
  });

  it("디자인 계열 keyword를 'AI 디자인'으로 묶는다", () => {
    for (const kw of ["AI 디자인 활용", "디자인하는AI"]) {
      expect(categoryOf(kw)).toBe("AI 디자인");
    }
  });

  it("개발 채널 계열 keyword를 '개발 학습'으로 묶는다", () => {
    for (const kw of [
      "Eric Tech",
      "빌더 조쉬 Builder Josh",
      "코딩알려주는누나",
      "데키랩",
    ]) {
      expect(categoryOf(kw)).toBe("개발 학습");
    }
  });

  it("매핑에 없는 keyword는 '기타'로 떨어진다", () => {
    expect(categoryOf("처음 보는 채널")).toBe("기타");
    expect(categoryOf("")).toBe("기타");
  });

  it("INSIGHT_CATEGORIES는 표시 순서를 정의하고 '기타'를 마지막에 둔다", () => {
    expect(INSIGHT_CATEGORIES).toEqual([
      "AI 코딩",
      "업무 자동화",
      "AI 디자인",
      "개발 학습",
      "기타",
    ]);
  });
});
