import { describe, it, expect } from "vitest";
import { officialOrgName } from "../official-org";
import type { AssigneeRow } from "../assignee-match";

const row = (university: string): AssigneeRow =>
  ({ university, operator: "김담당" }) as AssigneeRow;

/**
 * 봉투에 적힌 줄임말을 정식 명칭으로 바꾼다.
 *
 * 문자열 규칙으로 만들지 않는다 — `덕성여대` 에 `학교` 를 붙이면 `덕성여대학교` 가
 * 된다(정답은 `덕성여자대학교`). 총괄장에서 이미 찾아낸 이름이 있으니 그걸 쓴다.
 */
describe("정식 명칭 붙이기", () => {
  it("후보가 하나면 그 이름을 쓴다", () => {
    expect(officialOrgName("충청대", [row("충청대학교")])).toBe("충청대학교");
  });

  it("여대는 '여자대학교' 다 — 문자열로 붙이면 틀린다", () => {
    expect(officialOrgName("덕성여대", [row("덕성여자대학교")])).toBe(
      "덕성여자대학교",
    );
  });

  it("고등학교도 편다", () => {
    expect(officialOrgName("인천예술고", [row("인천예술고등학교")])).toBe(
      "인천예술고등학교",
    );
  });

  it("대학원 표시는 뒤에 남긴다 — 어느 시트를 봤는지가 사라지면 안 된다", () => {
    expect(officialOrgName("인천대 대학원", [row("인천대학교")])).toBe(
      "인천대학교 대학원",
    );
  });

  it("후보가 여럿이면 손대지 않는다 — 어느 쪽인지 모른다", () => {
    expect(
      officialOrgName("건국대", [row("건국대학교(서울)"), row("건국대학교(글로컬)")]),
    ).toBe("건국대");
  });

  it("후보가 없으면 손대지 않는다 — 지어내지 않는다", () => {
    expect(officialOrgName("교육대학원", [])).toBe("교육대학원");
  });

  it("이미 정식 명칭이면 그대로다", () => {
    expect(officialOrgName("충남대학교", [row("충남대학교")])).toBe("충남대학교");
  });

  it("캠퍼스 괄호가 붙은 정식 명칭도 그대로 가져온다", () => {
    expect(officialOrgName("가톨릭대", [row("가톨릭대학교(성심교정)")])).toBe(
      "가톨릭대학교(성심교정)",
    );
  });

  it("빈 값은 빈 값이다", () => {
    expect(officialOrgName(null, [row("충청대학교")])).toBeNull();
    expect(officialOrgName("", [row("충청대학교")])).toBe("");
  });

  it("대학원이 이미 정식 명칭에 붙어 있으면 두 번 붙이지 않는다", () => {
    expect(officialOrgName("인천대 대학원", [row("인천대학교 대학원")])).toBe(
      "인천대학교 대학원",
    );
  });
});
