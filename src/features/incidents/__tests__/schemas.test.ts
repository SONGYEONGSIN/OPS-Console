import { describe, it, expect } from "vitest";
import {
  incidentRowSchema,
  incidentCreateSchema,
  incidentUpdateSchema,
  APP_TYPE_VALUES,
  DEPARTMENT_VALUES,
  STATUS_VALUES,
} from "../schemas";

const baseCreate = {
  year: 2027,
  university_name: "건국대학교(서울)",
  app_type: "공통원서" as const,
  category: "결제",
  occurred_date: "2026-05-16",
  resolved_date: null,
  title: "결제 오류",
  cause_summary: "사용자 결제 실패 다수 발생",
  root_cause: "PG사 timeout",
  resolution: "재시도 안내",
  prevention: "alert threshold 조정",
  department: "운영부-운영1팀" as const,
  status: "처리중" as const,
};

describe("enum values", () => {
  it("APP_TYPE 3값", () => {
    expect(APP_TYPE_VALUES).toEqual(["공통원서", "일반원서", "공공원서"]);
  });
  it("DEPARTMENT 2값", () => {
    expect(DEPARTMENT_VALUES).toEqual(["운영부-운영1팀", "운영부-운영2팀"]);
  });
  it("STATUS 4값", () => {
    expect(STATUS_VALUES).toEqual(["미처리", "처리중", "처리완료", "보류"]);
  });
});

describe("incidentCreateSchema", () => {
  it("정상 입력 통과", () => {
    const r = incidentCreateSchema.safeParse(baseCreate);
    expect(r.success).toBe(true);
  });

  it("status 미지정 시 default '미처리'", () => {
    const { status: _omit, ...withoutStatus } = baseCreate;
    void _omit;
    const r = incidentCreateSchema.safeParse(withoutStatus);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("미처리");
  });

  it("app_type enum 외 값 거부", () => {
    const r = incidentCreateSchema.safeParse({
      ...baseCreate,
      app_type: "엉뚱원서",
    });
    expect(r.success).toBe(false);
  });

  it("department enum 외 값 거부", () => {
    const r = incidentCreateSchema.safeParse({
      ...baseCreate,
      department: "운영부-운영3팀",
    });
    expect(r.success).toBe(false);
  });

  it("status enum 외 값 거부", () => {
    const r = incidentCreateSchema.safeParse({
      ...baseCreate,
      status: "완료됨",
    });
    expect(r.success).toBe(false);
  });

  it("title 누락 거부", () => {
    const r = incidentCreateSchema.safeParse({ ...baseCreate, title: "" });
    expect(r.success).toBe(false);
  });

  it("university_name 누락 거부", () => {
    const r = incidentCreateSchema.safeParse({
      ...baseCreate,
      university_name: "",
    });
    expect(r.success).toBe(false);
  });

  it("category 누락 거부", () => {
    const r = incidentCreateSchema.safeParse({ ...baseCreate, category: "" });
    expect(r.success).toBe(false);
  });

  it("year 범위 외 거부", () => {
    expect(
      incidentCreateSchema.safeParse({ ...baseCreate, year: 1999 }).success,
    ).toBe(false);
    expect(
      incidentCreateSchema.safeParse({ ...baseCreate, year: 3001 }).success,
    ).toBe(false);
  });

  it("일자 null 허용 (선택 입력)", () => {
    const r = incidentCreateSchema.safeParse({
      ...baseCreate,
      occurred_date: null,
      resolved_date: null,
    });
    expect(r.success).toBe(true);
  });

  it("본문 4섹션 모두 null 허용", () => {
    const r = incidentCreateSchema.safeParse({
      ...baseCreate,
      cause_summary: null,
      root_cause: null,
      resolution: null,
      prevention: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("incidentRowSchema", () => {
  it("정상 DB row 파싱", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      year: 2027,
      university_name: "건국대학교(서울)",
      app_type: "공통원서",
      category: "결제",
      occurred_date: "2026-05-16",
      resolved_date: null,
      title: "결제 오류",
      cause_summary: "다수 발생",
      root_cause: null,
      resolution: null,
      prevention: null,
      department: "운영부-운영1팀",
      assignee_email: "x@example.com",
      assignee_name: "X",
      reporter_email: "alcure23@jinhakapply.com",
      reporter_name: "허승철",
      status: "처리중",
      created_at: "2026-05-16T00:00:00Z",
      updated_at: "2026-05-16T00:00:00Z",
    };
    const r = incidentRowSchema.safeParse(row);
    expect(r.success).toBe(true);
  });
});

describe("incidentUpdateSchema", () => {
  it("partial — 빈 객체 통과", () => {
    const r = incidentUpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("일부 필드만 변경 통과", () => {
    const r = incidentUpdateSchema.safeParse({ status: "처리완료" });
    expect(r.success).toBe(true);
  });

  it("enum 외 값은 partial이라도 거부", () => {
    const r = incidentUpdateSchema.safeParse({ status: "완료됨" });
    expect(r.success).toBe(false);
  });
});
