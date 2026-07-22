import { describe, it, expect } from "vitest";
import { buildSeedItems } from "../actions";
import { CHECKLIST_TEMPLATE } from "../template";

describe("buildSeedItems", () => {
  it("template 시드는 템플릿 개수만큼, 상태/메모 비움", () => {
    const rows = buildSeedItems("template", CHECKLIST_TEMPLATE, []);
    expect(rows.length).toBe(CHECKLIST_TEMPLATE.length);
    expect(rows[0]).toMatchObject({ status: null, note: "" });
    expect(rows[0].department).toBe(CHECKLIST_TEMPLATE[0].department);
  });
  it("clone 시드는 복제 항목의 부서/분야/항목 유지 + 상태/메모 초기화", () => {
    const cloned = [
      {
        department: "개발부" as const,
        category: "서버/시스템",
        title: "X",
        status: "done" as const,
        note: "완료",
        sortOrder: 3,
      },
    ];
    const rows = buildSeedItems("clone", CHECKLIST_TEMPLATE, cloned);
    expect(rows).toEqual([
      {
        department: "개발부",
        category: "서버/시스템",
        title: "X",
        status: null,
        note: "",
        sortOrder: 3,
      },
    ]);
  });
  it("empty 시드는 빈 배열", () => {
    expect(buildSeedItems("empty", CHECKLIST_TEMPLATE, [])).toEqual([]);
  });
});
