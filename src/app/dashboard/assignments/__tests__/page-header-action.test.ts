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

  it("목록과 같은 파일을 여는 링크를 가져온다", () => {
    expect(src).toContain("getAssignmentsWorkbookUrl");
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

  it("링크가 없으면 버튼을 안 그린다 — 깨진 링크를 누르게 하지 않는다", () => {
    expect(src).toMatch(/workbookUrl\s*\?/);
  });
});
