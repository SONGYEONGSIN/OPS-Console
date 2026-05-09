import { describe, it, expect } from "vitest";
import {
  operatorRowSchema,
  operatorUpdateSchema,
  operatorCreateSchema,
} from "../schemas";

describe("operatorRowSchema", () => {
  it("정상 row 통과", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      email: "test@example.com",
      name: "홍길동",
      team: "운영1팀",
      role: "매니저",
      emp_no: "20240101",
      hired_at: "2024-01-01",
      birth_date: "1990-01-01",
      gender: "남",
      division: "어플라이사업본부",
      department: "운영부",
      status: "active",
      permission: "member",
      leader: null,
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:00:00Z",
    };
    const result = operatorRowSchema.safeParse(row);
    expect(result.success).toBe(true);
  });

  it("잘못된 status — 거부", () => {
    const result = operatorRowSchema.safeParse({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      email: "x@y.com",
      name: "x",
      team: "운영1팀",
      role: "매니저",
      emp_no: "1",
      hired_at: "2024-01-01",
      birth_date: "1990-01-01",
      gender: "남",
      division: "어플라이사업본부",
      department: "운영부",
      status: "BAD",
      leader: null,
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("operatorRowSchema permission", () => {
  const baseRow = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    email: "x@y.com",
    name: "x",
    team: "운영1팀",
    role: "매니저",
    emp_no: "1",
    hired_at: "2024-01-01",
    birth_date: "1990-01-01",
    gender: "남",
    division: "어플라이사업본부",
    department: "운영부",
    status: "active",
    leader: null,
    created_at: "2026-05-09T00:00:00Z",
    updated_at: "2026-05-09T00:00:00Z",
  };

  it("permission='admin' 정상 통과 + data.permission 노출", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, permission: "admin" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.permission).toBe("admin");
  });

  it("permission 잘못된 enum 거부", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, permission: "BAD" });
    expect(r.success).toBe(false);
  });

  it("permission 누락 거부 (필수 필드)", () => {
    const r = operatorRowSchema.safeParse(baseRow);
    expect(r.success).toBe(false);
  });
});

describe("operatorUpdateSchema", () => {
  it("부분 update OK", () => {
    expect(
      operatorUpdateSchema.safeParse({ status: "inactive" }).success,
    ).toBe(true);
  });

  it("permission만 update OK", () => {
    expect(
      operatorUpdateSchema.safeParse({ permission: "viewer" }).success,
    ).toBe(true);
  });

  it("permission 잘못된 enum 거부", () => {
    expect(
      operatorUpdateSchema.safeParse({ permission: "BAD" }).success,
    ).toBe(false);
  });
});

describe("operatorCreateSchema", () => {
  it("필수 필드 모두 — 통과 (status default active)", () => {
    const r = operatorCreateSchema.safeParse({
      email: "new@example.com",
      name: "신규",
      team: "운영1팀",
      role: "매니저",
      emp_no: "20260101",
      hired_at: "2026-01-01",
      birth_date: "2000-01-01",
      gender: "여",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("active");
  });

  it("이메일 누락 — 거부", () => {
    expect(
      operatorCreateSchema.safeParse({
        name: "x",
        team: "운영1팀",
        role: "매니저",
        emp_no: "x",
        hired_at: "2024-01-01",
        birth_date: "1990-01-01",
        gender: "남",
      }).success,
    ).toBe(false);
  });
});
