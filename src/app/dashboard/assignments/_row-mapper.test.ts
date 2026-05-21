import { describe, it, expect } from "vitest";
import {
  univRowToListRow,
  matchesAssignmentQuery,
  isMyAssignment,
} from "./_row-mapper";
import type { UnivAssignmentRow } from "@/features/assignments/schemas";

const univ: UnivAssignmentRow = {
  university: "고려대학교",
  byService: {
    "원서접수": { university: "고려대학교", service: "원서접수", operator: "김슬기", developer: "박형진", detail: [] },
    "PIMS": { university: "고려대학교", service: "PIMS", operator: "한효진", developer: "", detail: [] },
  },
};

/** 원서접수에 subtypes가 있는 univ (representative op/dev ≠ subtype 담당자) */
const univWithSubtypes: UnivAssignmentRow = {
  university: "서울대학교",
  byService: {
    "원서접수": {
      university: "서울대학교",
      service: "원서접수",
      operator: "수시운영자",
      developer: "수시개발자",
      detail: [],
      subtypes: [
        { label: "수시", operator: "수시운영자", developer: "수시개발자" },
        { label: "정시", operator: "정시전담자", developer: "정시개발자" },
      ],
    },
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

describe("isMyAssignment", () => {
  const r = univRowToListRow(univ);
  it("운영자 본인이면 true", () => expect(isMyAssignment(r, "김슬기")).toBe(true));
  it("개발자 본인이면 true", () => expect(isMyAssignment(r, "박형진")).toBe(true));
  it("타 서비스 운영자도 true (한효진=PIMS 운영)", () =>
    expect(isMyAssignment(r, "한효진")).toBe(true));
  it("미배정 이름이면 false", () => expect(isMyAssignment(r, "정윤나")).toBe(false));
  it("빈 이름이면 false", () => expect(isMyAssignment(r, "")).toBe(false));
  it("부분 일치는 false (정확 일치만)", () =>
    expect(isMyAssignment(r, "김슬")).toBe(false));

  describe("subtypes 포함 내 배정 검색", () => {
    const rWithSub = univRowToListRow(univWithSubtypes);
    it("subtype 운영자(정시전담자)로 true", () =>
      expect(isMyAssignment(rWithSub, "정시전담자")).toBe(true));
    it("subtype 개발자(정시개발자)로 true", () =>
      expect(isMyAssignment(rWithSub, "정시개발자")).toBe(true));
    it("subtype에 없는 이름은 false", () =>
      expect(isMyAssignment(rWithSub, "없는사람")).toBe(false));
    it("subtype 부분 일치는 false", () =>
      expect(isMyAssignment(rWithSub, "정시전담")).toBe(false));
  });
});

describe("matchesAssignmentQuery subtypes", () => {
  const rWithSub = univRowToListRow(univWithSubtypes);
  it("subtype operator에만 있는 이름으로 검색 → true", () =>
    expect(matchesAssignmentQuery(rWithSub, "정시전담자")).toBe(true));
  it("subtype developer에만 있는 이름으로 검색 → true", () =>
    expect(matchesAssignmentQuery(rWithSub, "정시개발자")).toBe(true));
  it("subtype 부분 검색도 true (includes)", () =>
    expect(matchesAssignmentQuery(rWithSub, "정시전담")).toBe(true));
  it("아무 subtype에도 없는 이름 → false", () =>
    expect(matchesAssignmentQuery(rWithSub, "없는이름")).toBe(false));
});
