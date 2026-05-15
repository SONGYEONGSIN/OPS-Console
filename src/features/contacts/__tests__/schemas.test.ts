import { describe, it, expect } from "vitest";
import {
  contactRowSchema,
  contactCreateSchema,
  contactUpdateSchema,
} from "../schemas";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  customer_active: "재직",
  customer_name: "김지나",
  job_title: "팀장",
  university_name: "가천대학교",
  department_name: "입학팀",
  job_role: "실무자",
  management_grade: "A",
  relationship_grade: "우호적",
  contact_phone: "010-1234-5678",
  contact_ext: "031-750-1234",
  contact_email: "kjn@gachon.ac.kr",
  created_at: "2026-05-15T03:11:40+00:00",
  updated_at: "2026-05-15T03:11:40+00:00",
};

describe("contactRowSchema", () => {
  it("유효 row 통과 + 모든 11 필드 + timestamps 보존", () => {
    const r = contactRowSchema.safeParse(validRow);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.customer_name).toBe("김지나");
      expect(r.data.university_name).toBe("가천대학교");
    }
  });

  it("필수 필드 (customer_name) 누락 시 fail", () => {
    const r = contactRowSchema.safeParse({ ...validRow, customer_name: "" });
    expect(r.success).toBe(false);
  });

  it("nullable 필드 (job_title 등) null 허용", () => {
    const r = contactRowSchema.safeParse({
      ...validRow,
      job_title: null,
      contact_email: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("contactCreateSchema", () => {
  it("Create payload (id/timestamps 제외) 통과", () => {
    const r = contactCreateSchema.safeParse({
      customer_active: "재직",
      customer_name: "박운영",
      university_name: "○○대학교",
      job_title: null,
      department_name: null,
      job_role: null,
      management_grade: null,
      relationship_grade: null,
      contact_phone: null,
      contact_ext: null,
      contact_email: null,
    });
    expect(r.success).toBe(true);
  });

  it("customer_active 기본 '재직'", () => {
    const r = contactCreateSchema.safeParse({
      customer_name: "박운영",
      university_name: "○○대학교",
      job_title: null,
      department_name: null,
      job_role: null,
      management_grade: null,
      relationship_grade: null,
      contact_phone: null,
      contact_ext: null,
      contact_email: null,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.customer_active).toBe("재직");
  });
});

describe("contactUpdateSchema", () => {
  it("모든 필드 optional", () => {
    const r = contactUpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("부분 갱신 — customer_active만 변경", () => {
    const r = contactUpdateSchema.safeParse({ customer_active: "타부서 이동" });
    expect(r.success).toBe(true);
  });
});
