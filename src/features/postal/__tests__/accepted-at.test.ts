import { describe, it, expect } from "vitest";
import { formatAcceptedAt } from "../accepted-at";

/**
 * 영수증에 찍힌 **우체국 접수 일시**. 판독기가 문자열로 읽어 오므로 형태가 일정하지
 * 않다. 같은 표의 '올린 날' 과 같은 모양으로 맞춘다 — 한 표에서 표기가 갈리면
 * 어느 쪽이 이른지 눈으로 비교할 수 없다.
 */
describe("접수 일시 표기", () => {
  it("올린 날과 같은 모양으로 맞춘다", () => {
    expect(formatAcceptedAt("2026-08-21 15:44")).toBe("08. 21. 15:44");
  });

  it("24시간제 그대로 — 오후로 바꾸지 않는다", () => {
    expect(formatAcceptedAt("2026-08-21 16:48")).toBe("08. 21. 16:48");
  });

  it("초가 붙어 와도 분까지만 보여준다", () => {
    expect(formatAcceptedAt("2026-08-21 15:44:02")).toBe("08. 21. 15:44");
  });

  it("T 로 이어져 와도 읽는다", () => {
    expect(formatAcceptedAt("2026-08-21T15:44")).toBe("08. 21. 15:44");
  });

  it("날짜만 오면 날짜만 보여준다 — 없는 시각을 만들지 않는다", () => {
    expect(formatAcceptedAt("2026-08-21")).toBe("08. 21.");
  });

  it("모르는 형태는 그대로 보여준다 — 판독한 값을 잃지 않는다", () => {
    expect(formatAcceptedAt("접수 2026년 8월 21일")).toBe("접수 2026년 8월 21일");
  });

  it("없으면 —", () => {
    expect(formatAcceptedAt(null)).toBe("—");
    expect(formatAcceptedAt("")).toBe("—");
  });

  it("시간대를 붙이지 않는다 — 영수증의 시각은 이미 한국 시각이다", () => {
    // Date 로 파싱하면 브라우저 시간대에 따라 하루가 밀린다.
    expect(formatAcceptedAt("2026-01-01 00:30")).toBe("01. 01. 00:30");
  });
});
