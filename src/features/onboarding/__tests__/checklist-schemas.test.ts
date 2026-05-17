import { describe, it, expect } from "vitest";
import {
  checklistItemRowSchema,
  checklistToggleSchema,
} from "../checklist-schemas";

describe("checklistItemRowSchema", () => {
  it("DB row parse", () => {
    const row = {
      id: "a1b2c3d4-1234-4567-89ab-123456789012",
      cohort_id: "b2c3d4e5-1234-4567-89ab-123456789012",
      section_key: "입사 및 계정 설정",
      item_key: "인사 및 자리 안내",
      checked: true,
      checked_at: "2026-05-17T10:00:00Z",
      created_at: "2026-05-17T09:00:00Z",
      updated_at: "2026-05-17T10:00:00Z",
    };
    expect(checklistItemRowSchema.parse(row).item_key).toBe("인사 및 자리 안내");
  });

  it("checked_at null 허용", () => {
    const row = {
      id: "a1b2c3d4-1234-4567-89ab-123456789012",
      cohort_id: "b2c3d4e5-1234-4567-89ab-123456789012",
      section_key: "입사",
      item_key: "자리 안내",
      checked: false,
      checked_at: null,
      created_at: "2026-05-17T09:00:00Z",
      updated_at: "2026-05-17T09:00:00Z",
    };
    expect(checklistItemRowSchema.parse(row).checked).toBe(false);
  });
});

describe("checklistToggleSchema", () => {
  const valid = {
    cohort_id: "b2c3d4e5-1234-4567-89ab-123456789012",
    section_key: "입사 및 계정 설정",
    item_key: "인사 및 자리 안내",
    checked: true,
  };

  it("유효 입력 — parse 성공", () => {
    expect(checklistToggleSchema.parse(valid).checked).toBe(true);
  });

  it("cohort_id uuid 아님 — reject", () => {
    expect(() =>
      checklistToggleSchema.parse({ ...valid, cohort_id: "x" }),
    ).toThrow();
  });

  it("section_key 빈 — reject", () => {
    expect(() =>
      checklistToggleSchema.parse({ ...valid, section_key: "" }),
    ).toThrow();
  });

  it("item_key 빈 — reject", () => {
    expect(() =>
      checklistToggleSchema.parse({ ...valid, item_key: "" }),
    ).toThrow();
  });
});
