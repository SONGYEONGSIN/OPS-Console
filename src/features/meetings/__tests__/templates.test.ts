import { describe, it, expect } from "vitest";
import { buildSeedBlocks, MEETING_TEMPLATES } from "../templates";

describe("MEETING_TEMPLATES", () => {
  it("5개 유형 모두 섹션 정의가 있다", () => {
    expect(Object.keys(MEETING_TEMPLATES).sort()).toEqual(
      ["field", "memo", "project", "regular", "urgent"].sort(),
    );
    for (const secs of Object.values(MEETING_TEMPLATES)) {
      expect(secs.length).toBeGreaterThan(0);
    }
  });

  it("정기회의: 지난 안건 점검·후속 조치 표 + 비고 노트", () => {
    const titles = MEETING_TEMPLATES.regular.map((s) => s.title);
    expect(titles).toContain("지난 안건 점검");
    expect(titles).toContain("후속 조치");
    expect(titles).toContain("비고");
  });
});

describe("buildSeedBlocks", () => {
  it("각 섹션 title을 heading 블록으로 시드한다", () => {
    const blocks = buildSeedBlocks("regular");
    const headings = blocks
      .filter((b) => b.type === "heading")
      .map((b) => (b as { content: string }).content);
    expect(headings).toContain("지난 안건 점검");
    expect(headings).toContain("후속 조치");
  });

  it("table 섹션은 table 블록(헤더행 + 빈 행)을 만든다", () => {
    const blocks = buildSeedBlocks("regular");
    const table = blocks.find((b) => b.type === "table");
    expect(table).toBeDefined();
    const rows = (table as { content: { rows: { cells: string[] }[] } }).content
      .rows;
    // 헤더행 + 빈 행 ≥ 2
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // 첫 행은 컬럼 헤더(비어있지 않음)
    expect(rows[0].cells.some((c) => c !== "")).toBe(true);
    // 이후 행은 빈 셀
    expect(rows[1].cells.every((c) => c === "")).toBe(true);
  });

  it("kv 섹션(프로젝트 목표·범위)은 하위 heading + 빈 문단", () => {
    const blocks = buildSeedBlocks("project");
    const h3 = blocks.filter(
      (b) => b.type === "heading" && (b as { props: { level: number } }).props.level === 3,
    );
    expect(h3.length).toBeGreaterThan(0);
  });

  it("notes/list 섹션은 bulletListItem을 만든다", () => {
    const blocks = buildSeedBlocks("memo");
    expect(blocks.some((b) => b.type === "bulletListItem")).toBe(true);
  });
});
