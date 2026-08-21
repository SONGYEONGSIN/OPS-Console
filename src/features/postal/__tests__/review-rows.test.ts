import { describe, it, expect } from "vitest";
import { buildReviewRows } from "../review-rows";
import type { AssigneeRow } from "../assignee-match";

const UNDER: AssigneeRow[] = [
  { university: "우석대학교", operator: "김지현" },
  { university: "국립창원대학교", operator: "기자의" },
  { university: "창원문성대학교", operator: "김지나" },
  { university: "건국대학교(서울)", operator: "이해영" },
  { university: "건국대학교(글로컬)", operator: "전혜인" },
];
const GRAD: AssigneeRow[] = [{ university: "국립창원대학교", operator: "김승현" }];

const items = [
  { tracking_no: "11263-1102-7082", fee: 4470, postal_code: "51140", recipient_org: "창원대", recipient_name: "김좌경" },
  { tracking_no: "11263-1102-7080", fee: 4590, postal_code: "55338", recipient_org: "우석대", recipient_name: "강정화" },
];

describe("buildReviewRows", () => {
  it("등기번호 순으로 순번을 매긴다 — 표시 순서도 그 순서다", () => {
    const rows = buildReviewRows(items, { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 });
    expect(rows.map((r) => r.daySeq)).toEqual([1, 2]);
    expect(rows[0].trackingNo).toBe("11263-1102-7080");
  });

  it("같은 날 앞선 영수증이 있으면 이어서 붙인다", () => {
    const rows = buildReviewRows(items, { under: UNDER, grad: GRAD, alreadyOnThatDay: 4 });
    expect(rows.map((r) => r.daySeq)).toEqual([5, 6]);
  });

  it("담당자가 유일하면 채운다", () => {
    const rows = buildReviewRows(items, { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 });
    // 등기번호로 찾는다 — 소속명은 정식 명칭으로 바뀌므로 그걸로 찾으면 흔들린다.
    expect(
      rows.find((r) => r.trackingNo === "11263-1102-7080")?.assignee,
    ).toBe("김지현");
  });

  it("'대학원'이 붙으면 대학원 시트 담당자", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "창원대 대학원" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].assignee).toBe("김승현");
    expect(rows[0].basis).toBe("graduate");
  });

  it("후보가 여럿이면 비워두고 후보를 남긴다 — 틀린 담당자가 조용히 들어가면 안 된다", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "건국대" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].assignee).toBeNull();
    expect(rows[0].candidates.map((c) => c.operator)).toEqual(["이해영", "전혜인"]);
  });

  it("총괄장에 없으면 담당자도 후보도 없다", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "없는대" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].assignee).toBeNull();
    expect(rows[0].candidates).toEqual([]);
  });

  it("빈 목록은 빈 배열", () => {
    expect(buildReviewRows([], { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 })).toEqual([]);
  });

  // 봉투에 적힌 줄임말 대신 총괄장의 정식 명칭을 쓴다. 사람이 대장을 볼 때
  // '창원대'와 '국립창원대학교'가 섞여 있으면 같은 학교인지 매번 되짚어야 한다.
  it("후보가 하나면 정식 명칭으로 바꾼다", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "창원대" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].recipientOrg).toBe("국립창원대학교");
  });

  it("대학원 표시는 남긴다", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "창원대 대학원" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].recipientOrg).toBe("국립창원대학교 대학원");
  });

  it("후보가 여럿이면 원문 그대로 — 어느 캠퍼스인지 모른다", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "건국대" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].recipientOrg).toBe("건국대");
  });

  it("못 찾으면 원문 그대로 — 지어내지 않는다", () => {
    const rows = buildReviewRows(
      [{ ...items[0], recipient_org: "없는대" }],
      { under: UNDER, grad: GRAD, alreadyOnThatDay: 0 },
    );
    expect(rows[0].recipientOrg).toBe("없는대");
  });
});
