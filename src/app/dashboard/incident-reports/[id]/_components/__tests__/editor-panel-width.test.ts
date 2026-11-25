import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EDITOR_PANEL_WIDTH_CLASS } from "../editor-panel-width";

/**
 * 경위서 편집 패널 폭과 헤더 스페이서 폭은 한 상수에서 온다 — 둘이 갈리면
 * PDF 버튼이 문서 뷰어 오른쪽 끝에서 어긋난다.
 */
const dir = join(process.cwd(), "src/app/dashboard/incident-reports/[id]");
const read = (rel: string) => readFileSync(join(dir, rel), "utf-8");

describe("경위서 편집 패널 폭", () => {
  it("사고보고 작성 폭과 같은 560px", () => {
    expect(EDITOR_PANEL_WIDTH_CLASS).toBe("w-[560px]");
  });

  it("편집 패널과 헤더 스페이서가 같은 상수를 쓴다 (예전 360 리터럴 없음)", () => {
    for (const rel of ["page.tsx", "_components/ReportEditorWorkspace.tsx"]) {
      const src = read(rel);
      expect(src).toContain("EDITOR_PANEL_WIDTH_CLASS");
      expect(src).not.toContain("w-[360px]");
    }
  });
});
