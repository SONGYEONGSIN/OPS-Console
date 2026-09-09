import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 총괄장 화면 오른쪽에 원본 파일 버튼(2026-09-07 요청).
 *
 * 목록이 읽는 파일과 **같은 것**으로 이어져야 한다 — 다른 파일을 열면 고친 게
 * 화면에 안 나타나고 원인을 못 찾는다.
 */
describe("총괄장 헤더 액션", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/dashboard/assignments/page.tsx"),
    "utf8",
  );

  it("버튼을 늘 그린다 — 링크 조회 성공 여부에 매달지 않는다", () => {
    // 전에는 조회에 실패하면 버튼이 통째로 사라져, 사용자에게는 '기능이 안
    // 만들어진 것'과 구분되지 않았다(2026-09-09).
    expect(src).not.toContain("getAssignmentsWorkbookUrl");
    expect(src).not.toMatch(/workbookUrl\s*\?/);
  });

  it("원본 파일 창구로 보낸다", () => {
    expect(src).toContain("/dashboard/assignments/source");
  });

  it("헤더 액션 표준 버튼을 쓴다 — 문자열을 새로 적지 않는다", () => {
    expect(src).toContain("HeaderActionButton");
  });

  it("버튼 이름은 총괄장", () => {
    expect(src).toMatch(/HeaderActionButton[\s\S]{0,200}?총괄장/);
  });

  it("제목 오른쪽 자리에 넣는다", () => {
    expect(src).toContain("headlineAction");
  });


});
