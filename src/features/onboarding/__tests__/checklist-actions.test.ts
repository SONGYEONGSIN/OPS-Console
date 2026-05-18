import { describe, it, expect } from "vitest";
import { checklistToggleSchema } from "../checklist-schemas";

// checklist-actions.ts는 server-only. 여기선 schema 통과/거부와 export 시그니처만 점검.
// 권한 분기(trainee/admin)는 RLS + e2e에서.
describe("checklist actions — payload shape", () => {
  it("유효 토글 input", () => {
    const ok = checklistToggleSchema.safeParse({
      cohort_id: "b2c3d4e5-1234-4567-89ab-123456789012",
      section_key: "입사 및 계정 설정",
      item_key: "인사 및 자리 안내",
      checked: true,
    });
    expect(ok.success).toBe(true);
  });

  it("cohort_id 누락 — reject", () => {
    const r = checklistToggleSchema.safeParse({
      section_key: "x",
      item_key: "y",
      checked: false,
    });
    expect(r.success).toBe(false);
  });
});

describe("checklist actions — export 시그니처", () => {
  it("toggleChecklistItem는 async 함수", async () => {
    const mod = await import("../checklist-actions");
    expect(mod.toggleChecklistItem.constructor.name).toBe("AsyncFunction");
  });
});
