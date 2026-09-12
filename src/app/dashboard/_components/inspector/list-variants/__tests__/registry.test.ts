import { describe, it, expect } from "vitest";
import { variantRegistry } from "../registry";

describe("variantRegistry", () => {
  it("backup variant 등록됨 (View / EditForm / Table / Filters / blank)", () => {
    const entry = variantRegistry.backup;
    expect(entry).toBeDefined();
    expect(entry.View).toBeDefined();
    expect(entry.EditForm).toBeDefined();
    expect(entry.Table).toBeDefined();
    expect(entry.Filters).toBeDefined();
    expect(entry.blank).toBeDefined();
  });

  it("최소 10개 variant 등록 확인 (기존 9 + backup)", () => {
    expect(Object.keys(variantRegistry).length).toBeGreaterThanOrEqual(10);
  });

  it("ai-tip-candidates variant 등록됨 (View / Table / Filters 빈 배열)", () => {
    const entry = variantRegistry["ai-tip-candidates"];
    expect(entry).toBeDefined();
    expect(entry.View).toBeDefined();
    expect(entry.Table).toBeDefined();
    // 상태 칩은 페이지 searchParam(CandidateScopeChips)이 담당한다 —
    // variant 필터 칩과 겹치면 같은 뜻의 칩이 두 줄로 보인다.
    expect(entry.Filters).toEqual([]);
    // 후보는 수집 잡이 적재한다 — 화면에서 새로 만들지 않는다.
    expect("blank" in entry).toBe(false);
    expect("EditForm" in entry).toBe(false);
  });

  it("incident-reports variant 등록됨 (View / EditForm / Table / Filters / blank)", () => {
    const entry = variantRegistry["incident-reports"];
    expect(entry).toBeDefined();
    expect(entry.View).toBeDefined();
    expect(entry.EditForm).toBeDefined();
    expect(entry.Table).toBeDefined();
    expect(entry.Filters).toBeDefined();
    expect(entry.blank).toBeDefined();
  });
});
