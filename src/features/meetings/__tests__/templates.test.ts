import { describe, it, expect } from "vitest";
import { buildSeedBlocks, MEETING_SEED_HEADINGS } from "../templates";

describe("buildSeedBlocks", () => {
  it("외근·출장 보고 시드 섹션", () => {
    expect(MEETING_SEED_HEADINGS.field).toEqual([
      "방문 개요",
      "면담 내용",
      "주요 결과",
      "후속조치",
    ]);
  });
  it("각 헤딩은 heading 블록 + 빈 후속 블록", () => {
    const blocks = buildSeedBlocks("memo");
    const headings = blocks.filter((b) => b.type === "heading").map((b) => b.content);
    expect(headings).toEqual(["논의 주제", "메모", "액션아이템"]);
  });
  it("액션아이템 헤딩 뒤 checkListItem", () => {
    const blocks = buildSeedBlocks("regular");
    const idx = blocks.findIndex((b) => b.type === "heading" && b.content === "액션아이템");
    expect(blocks[idx + 1]?.type).toBe("checkListItem");
  });
  it("후속조치 뒤 checkListItem", () => {
    const blocks = buildSeedBlocks("field");
    const idx = blocks.findIndex((b) => b.type === "heading" && b.content === "후속조치");
    expect(blocks[idx + 1]?.type).toBe("checkListItem");
  });
});
