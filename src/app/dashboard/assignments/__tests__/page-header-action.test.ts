import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 총괄장 화면 오른쪽에 원본 파일 버튼(2026-09-07 요청).
 *
 * 버튼이 **어느 파일을 여는지**는 이제 등록부가 쥐고 있고, 키가 화면에 실재하는지는
 * 공용 가드(`features/workbook/__tests__/link-sites.test.ts`)가 본다. 여기 남은 건
 * 공용 가드가 못 보는 것 — **어느 자리에, 무슨 이름으로** 그리느냐다.
 */
describe("총괄장 헤더 액션", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/dashboard/assignments/page.tsx"),
    "utf8",
  );

  it("헤더 액션 표준 버튼을 쓴다 — 문자열을 새로 적지 않는다", () => {
    expect(src).toContain("HeaderActionButton");
  });

  it("버튼 이름은 총괄장", () => {
    expect(src).toMatch(/HeaderActionButton[\s\S]{0,200}?총괄장/);
  });

  it("목록 제목 줄(대학배정)에 넣는다 — 페이지 제목이 아니다", () => {
    // 처음엔 페이지 제목(서비스사이클 — 총괄장) 옆에 뒀는데, 표를 보는 자리와
    // 멀어 눈에 안 들어왔다(2026-09-09 지적).
    expect(src).toContain("extraActions");
    expect(src).not.toContain("headlineAction");
  });

  it("탭을 옮겨도 링크가 사라지지 않는다 — 업무분장·가격정책도 같은 파일이다", () => {
    // 세 탭이 한 파일의 사본이라, 한 탭에서만 보이면 나머지에선 길이 끊긴다.
    const uses = src.match(/sourceAction/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
  });

  it("총괄장 전용 창구가 남아 있지 않다 — 표준은 하나다", () => {
    // 별칭을 남기면 등록부를 고쳐도 옛 주소는 옛 코드를 타고, 둘이 어긋나는 날
    // 어느 쪽이 진짜인지 화면만 보고는 알 수 없다.
    expect(
      existsSync(join(process.cwd(), "src/app/dashboard/assignments/source")),
    ).toBe(false);
  });
});
