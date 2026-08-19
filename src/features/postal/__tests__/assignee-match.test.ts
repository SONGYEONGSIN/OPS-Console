import { describe, it, expect } from "vitest";
import {
  isGraduate,
  splitRecipient,
  matchAssignee,
  type AssigneeRow,
} from "../assignee-match";

const UNDER: AssigneeRow[] = [
  { university: "우석대학교", operator: "김지현" },
  { university: "한림성심대학교", operator: "김승현" },
  { university: "국립창원대학교", operator: "기자의" },
  { university: "창원문성대학교", operator: "김지나" },
  { university: "한국폴리텍Ⅶ대학(창원,부산,울산)", operator: "임종우" },
  { university: "건국대학교(서울)", operator: "이해영" },
  { university: "건국대학교(글로컬)", operator: "전혜인" },
];

const GRAD: AssigneeRow[] = [
  { university: "국립창원대학교", operator: "김승현" },
  { university: "동아대학교", operator: "기자의" },
];

describe("splitRecipient", () => {
  it("마지막 낱말이 이름, 앞이 소속", () => {
    expect(splitRecipient("우석대 강정화")).toEqual({
      org: "우석대",
      name: "강정화",
    });
  });

  it("소속에 띄어쓰기가 있어도 마지막만 이름", () => {
    expect(splitRecipient("창원대 대학원 김좌경")).toEqual({
      org: "창원대 대학원",
      name: "김좌경",
    });
  });

  it("낱말이 하나면 이름으로 본다 — 소속 없는 수취인도 있다", () => {
    expect(splitRecipient("강정화")).toEqual({ org: "", name: "강정화" });
  });

  it("빈 문자열은 둘 다 빈칸", () => {
    expect(splitRecipient("  ")).toEqual({ org: "", name: "" });
  });
});

describe("isGraduate", () => {
  it("'대학원'이 있으면 대학원 기준", () => {
    expect(isGraduate("창원대 대학원")).toBe(true);
  });

  it("없으면 학부 기준 — 영수증에 안 적혀 있으면 학부다", () => {
    expect(isGraduate("창원대")).toBe(false);
  });
});

describe("matchAssignee", () => {
  it("'~대'는 그 낱말이 바로 '대학교'로 이어지는 곳만 — 창원문성대·폴리텍은 아니다", () => {
    const r = matchAssignee("창원대", UNDER, GRAD);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].university).toBe("국립창원대학교");
    expect(r.assignee).toBe("기자의");
  });

  it("'대학원'이 붙으면 대학원 시트를 본다 — 같은 대학이라도 담당자가 다르다", () => {
    const r = matchAssignee("창원대 대학원", UNDER, GRAD);
    expect(r.assignee).toBe("김승현");
    expect(r.basis).toBe("graduate");
  });

  it("대학원 표기가 없으면 학부 — 82%가 담당자가 달라 임의로 고르면 안 된다", () => {
    expect(matchAssignee("창원대", UNDER, GRAD).basis).toBe("undergraduate");
  });

  it("정식 명칭으로 적혀도 찾는다", () => {
    expect(matchAssignee("우석대학교", UNDER, GRAD).assignee).toBe("김지현");
  });

  it("캠퍼스가 둘이면 자동으로 고르지 않는다 — 틀린 담당자가 조용히 들어간다", () => {
    const r = matchAssignee("건국대", UNDER, GRAD);
    expect(r.candidates).toHaveLength(2);
    expect(r.assignee).toBeNull();
  });

  it("총괄장에 없으면 후보도 담당자도 없다", () => {
    const r = matchAssignee("없는대", UNDER, GRAD);
    expect(r.candidates).toEqual([]);
    expect(r.assignee).toBeNull();
  });

  it("찾았는데 담당자 칸이 비어 있으면 채우지 않는다", () => {
    const r = matchAssignee("빈대", [{ university: "빈대학교", operator: "" }], GRAD);
    expect(r.candidates).toHaveLength(1);
    expect(r.assignee).toBeNull();
  });

  it("대학원 표기가 있는데 대학원 시트에 없으면 후보 없음 — 학부로 몰래 넘어가지 않는다", () => {
    const r = matchAssignee("우석대 대학원", UNDER, GRAD);
    expect(r.basis).toBe("graduate");
    expect(r.candidates).toEqual([]);
  });

  it("소속이 비면 아무것도 하지 않는다", () => {
    expect(matchAssignee("", UNDER, GRAD).candidates).toEqual([]);
  });
});
