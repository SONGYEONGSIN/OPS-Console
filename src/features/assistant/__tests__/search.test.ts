import { describe, it, expect } from "vitest";
import { tokenize, scoreText, type Source } from "../search";

describe("tokenize", () => {
  it("공백 split + 길이 2 이상만 유지", () => {
    expect(tokenize("외국인 전형 입력 오류")).toEqual([
      "외국인",
      "전형",
      "입력",
      "오류",
    ]);
  });

  it("한 글자는 제외", () => {
    expect(tokenize("a 키 외국인")).toEqual(["외국인"]);
  });

  it("연속 공백/탭/개행 무관", () => {
    expect(tokenize("외국인\n  전형\t오류")).toEqual([
      "외국인",
      "전형",
      "오류",
    ]);
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("scoreText", () => {
  it("토큰 모두 포함 → 토큰 개수만큼 점수", () => {
    expect(scoreText("외국인 전형 입력 오류 처리", ["외국인", "전형"])).toBe(2);
  });

  it("일부 토큰만 포함 → 그 수만큼", () => {
    expect(scoreText("외국인 전형 처리", ["외국인", "오류"])).toBe(1);
  });

  it("대소문자 무관", () => {
    expect(scoreText("Claude prompt", ["claude"])).toBe(1);
  });

  it("토큰 0개 → 0점", () => {
    expect(scoreText("아무 내용", [])).toBe(0);
  });

  it("text가 빈 경우 0점", () => {
    expect(scoreText("", ["x"])).toBe(0);
  });
});

describe("Source type", () => {
  it("type signature 보존 — domain enum + deepLink", () => {
    const s: Source = {
      domain: "incident",
      id: "inc-1",
      title: "외국인 전형 오류",
      snippet: "...",
      deepLink: "/dashboard/incidents",
    };
    expect(s.domain).toBe("incident");
  });
});
