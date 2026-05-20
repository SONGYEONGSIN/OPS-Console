import { describe, it, expect } from "vitest";
import { univRowToListRow, matchesAssignmentQuery } from "./_row-mapper";
import type { UnivAssignmentRow } from "@/features/assignments/schemas";

const univ: UnivAssignmentRow = {
  university: "고려대학교",
  byService: {
    "원서접수": { university: "고려대학교", service: "원서접수", operator: "김슬기", developer: "박형진", detail: [] },
    "PIMS": { university: "고려대학교", service: "PIMS", operator: "한효진", developer: "", detail: [] },
  },
};

describe("univRowToListRow", () => {
  it("대학명=name, byService 매핑", () => {
    const r = univRowToListRow(univ);
    expect(r.name).toBe("고려대학교");
    expect(r.assignment?.byService["원서접수"].operator).toBe("김슬기");
    expect(r.assignment?.byService["PIMS"].developer).toBe("");
    expect(r.status).toBe("active");
  });
});

describe("matchesAssignmentQuery", () => {
  it("대학명/담당자 양방향, 빈 term true", () => {
    const r = univRowToListRow(univ);
    expect(matchesAssignmentQuery(r, "")).toBe(true);
    expect(matchesAssignmentQuery(r, "고려")).toBe(true);
    expect(matchesAssignmentQuery(r, "박형진")).toBe(true);
    expect(matchesAssignmentQuery(r, "없는사람")).toBe(false);
  });
});
