import { describe, it, expect } from "vitest";
import { resolveScopeFilter, chipOptions } from "../scope";

/**
 * 같은 목록(`closing_services` 867건)을 두 메뉴가 나눠 본다.
 *
 * - **배포 · 운영** — 아직 마감 전인 것. 지금 운영해야 할 대상이다.
 * - **서비스마감** — 마감이 지난 것. 정산·회고 대상이다.
 *
 * 한 화면에 섞어 두고 칩으로 가르던 것을 메뉴로 갈랐다. 그래서 **각 메뉴 안에서는
 * 마감여부를 다시 고르지 않는다** — '전체'는 그 메뉴가 맡은 범위의 전체다.
 */
describe("메뉴별 범위", () => {
  it("배포·운영의 '전체'는 진행중 전체다", () => {
    expect(resolveScopeFilter("open", "all", "김담당")).toEqual({
      closedStatus: "open",
      operatorName: undefined,
    });
  });

  it("서비스마감의 '전체'는 마감된 것 전체다 — 진행중이 섞이지 않는다", () => {
    expect(resolveScopeFilter("closed", "all", "김담당")).toEqual({
      closedStatus: "closed",
      operatorName: undefined,
    });
  });

  it("'내 것'은 범위 안에서 본인 담당만", () => {
    expect(resolveScopeFilter("open", "mine", "김담당")).toEqual({
      closedStatus: "open",
      operatorName: "김담당",
    });
    expect(resolveScopeFilter("closed", "mine", "김담당")).toEqual({
      closedStatus: "closed",
      operatorName: "김담당",
    });
  });

  it("모르는 칩은 '내 것'으로 본다 — 기본값이 그것이다", () => {
    expect(resolveScopeFilter("closed", "없는칩", "김담당").operatorName).toBe(
      "김담당",
    );
  });

  it("이름이 없으면 빈 문자열 — 아무것도 안 걸리는 편이 남의 것을 보여주는 것보다 낫다", () => {
    expect(resolveScopeFilter("open", "mine", null).operatorName).toBe("");
  });

  it("범위는 칩이 못 바꾼다 — 마감 메뉴에서 진행중이 나오면 안 된다", () => {
    for (const chip of ["all", "mine", "open", "이상한값"]) {
      expect(resolveScopeFilter("closed", chip, "김담당").closedStatus).toBe(
        "closed",
      );
    }
  });
});

describe("칩 이름", () => {
  it("배포·운영은 '내 서비스'다 — 마감한 게 아니라 맡고 있는 것이다", () => {
    expect(chipOptions("open").map((o) => o.label)).toEqual([
      "전체",
      "내 서비스",
    ]);
  });

  it("서비스마감은 '내 마감'이다", () => {
    expect(chipOptions("closed").map((o) => o.label)).toEqual([
      "전체",
      "내 마감",
    ]);
  });

  it("진행중 칩은 없다 — 메뉴가 이미 범위를 정했다", () => {
    for (const scope of ["open", "closed"] as const) {
      expect(chipOptions(scope).map((o) => o.key)).not.toContain("open");
    }
  });
});
