import { describe, it, expect } from "vitest";
import { findSidebarMeta } from "./_data";

describe("findSidebarMeta", () => {
  it("section.entries item에서 slug 매칭", () => {
    expect(findSidebarMeta("alerts")).toEqual({
      label: "실시간 알림",
      pattern: "dash",
    });
  });

  it("group.items에서 slug 매칭 (재귀)", () => {
    expect(findSidebarMeta("infra-db")).toEqual({
      label: "DB · 저장소",
      pattern: "list",
    });
  });

  it("존재하지 않는 slug면 null", () => {
    expect(findSidebarMeta("nonexistent")).toBeNull();
  });
});
