import { describe, it, expect } from "vitest";
import { WORKBOOKS, getWorkbookEntry } from "../registry";
import type { WorkbookKey } from "../registry";
import { findSidebarMeta } from "@/app/dashboard/_data";

/**
 * 워크북 열람 창구 등록부.
 *
 * 버튼이 링크 조회에 매달리지 않게 하려고 라우트로 뺐다(총괄장 #1174~#1176 과
 * 같은 이유). 라우트가 하나라 **URL 이 추측 가능해진다** — 그래서 "누가 어느
 * 대장을 열 수 있나"가 여기 한 줄에 적혀 있어야 하고, 빠뜨릴 수 없어야 한다.
 */
describe("WORKBOOKS", () => {
  const keys = Object.keys(WORKBOOKS);

  it("일곱 대장이 등록돼 있다", () => {
    expect(keys.sort()).toEqual(
      [
        // 총괄장은 이 패턴의 출처(#1174~#1176)인데 자기 라우트로 남아 있었다.
        // 표준이 둘이면 다음 사람이 어느 쪽을 고칠지 모른다 — 여기로 흡수한다.
        "assignments-master",
        "contracts-ledger",
        "incidents-gongmun",
        "postal-ledger",
        "postal-petty-cash",
        "receivables-deposit",
        "receivables-ledger",
      ].sort(),
    );
  });

  it("모든 엔트리가 이름과 env 짝을 갖는다", () => {
    for (const [key, e] of Object.entries(WORKBOOKS)) {
      expect(e.label, key).toBeTruthy();
      expect(e.driveEnv, key).toMatch(/^SHAREPOINT_/);
      expect(e.itemEnv, key).toMatch(/^SHAREPOINT_/);
    }
  });

  /**
   * 미수채권 두 대장은 메인 드라이브가 아니다. 메인에 붙이면 Graph 가 404 를 내고,
   * 502 문구는 "env 를 확인하세요"라고 말해 **오진으로 유도한다.**
   */
  it("미수채권 두 대장은 별도 드라이브를 쓴다", () => {
    const pair: WorkbookKey[] = ["receivables-ledger", "receivables-deposit"];
    for (const k of pair) {
      expect(WORKBOOKS[k].driveEnv, k).toBe("SHAREPOINT_RECEIVABLES_DRIVE_ID");
    }
  });

  /**
   * 오늘 이 제한은 **렌더 게이팅뿐이고 서버 강제가 없다** — admin 에게만 버튼이
   * 그려져서 안전했을 뿐이다. 라우트로 빼는 순간 주소를 직접 칠 수 있으므로,
   * 여기서 admin 을 못박지 않으면 이 변경이 권한을 후퇴시킨다.
   */
  it("수수료입금내역만 admin 이다", () => {
    for (const [key, e] of Object.entries(WORKBOOKS)) {
      expect(e.adminOnly, key).toBe(key === "receivables-deposit");
    }
  });

  /** 빠뜨릴 수 없어야 한다 — 선택 필드면 언젠가 빠진다. */
  it("adminOnly 를 안 적은 엔트리가 없다", () => {
    for (const [key, e] of Object.entries(WORKBOOKS)) {
      expect(typeof e.adminOnly, key).toBe("boolean");
    }
  });

  /**
   * `canViewMenu` 는 admin-only 목록에 없는 slug 를 **전부 통과시킨다.**
   * 그래서 slug 오타는 조용히 열린다 — 사이드바에 실재하는지 여기서 본다.
   */
  it("menu 슬러그가 사이드바에 실재한다", () => {
    for (const [key, e] of Object.entries(WORKBOOKS)) {
      expect(findSidebarMeta(e.menu), `${key} → ${e.menu}`).toBeTruthy();
    }
  });

  it("모르는 키는 없다고 답한다", () => {
    expect(getWorkbookEntry("nope")).toBeUndefined();
  });

  it("아는 키는 엔트리를 준다", () => {
    expect(getWorkbookEntry("contracts-ledger")?.label).toBeTruthy();
  });
});
