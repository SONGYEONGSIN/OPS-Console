import { describe, it, expect } from "vitest";
import { pickFeatureIntros } from "../jobs/team-briefing-build";

/**
 * 5호는 어시스턴트를 소개한다.
 *
 * 4호는 소개 없음(빈 배열)이었고, 5호에 상황실 어시스턴트를 싣기로 했다
 * (2026-08-21 요청).
 */
describe("5호 기능 소개", () => {
  it("어시스턴트를 싣는다", () => {
    const picked = pickFeatureIntros(5);
    expect(picked.map((f) => f.title)).toContain("운영부 상황실 어시스턴트");
  });

  it("설명에 무엇을 물으면 되는지가 있다 — 이름만 알려주면 안 쓴다", () => {
    const f = pickFeatureIntros(5).find(
      (x) => x.title === "운영부 상황실 어시스턴트",
    );
    expect(f?.desc).toMatch(/물어|질문/);
  });

  it("4호는 그대로 비어 있다 — 과거 호를 건드리지 않는다", () => {
    expect(pickFeatureIntros(4)).toEqual([]);
  });
});
