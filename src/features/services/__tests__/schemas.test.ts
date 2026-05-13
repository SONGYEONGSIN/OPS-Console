import { describe, it, expect } from "vitest";
import {
  servicesRowSchema,
  servicesCreateSchema,
  servicesUpdateSchema,
} from "../schemas";

const validRow = {
  id: "00000000-0000-0000-0000-000000000000",
  service_id: 1234567,
  application_type: "공통원서",
  region: "서울",
  university_name: "○○대학교",
  service_name: "2026 수시 원서접수",
  university_type: "4년제",
  category: "수시",
  operator_email: "op1@example.com",
  operator_name: "박운영",
  developer_email: null,
  developer_name: null,
  write_start_at: "2026-08-01T00:00:00Z",
  write_end_at: "2026-09-15T00:00:00Z",
  pay_start_at: "2026-08-01T00:00:00Z",
  pay_end_at: "2026-09-15T00:00:00Z",
  solo: false,
  source: "google_sheet_import",
  imported_at: "2026-05-13T00:00:00Z",
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
};

describe("services/schemas — servicesRowSchema", () => {
  it("정상 row 파싱 통과", () => {
    expect(() => servicesRowSchema.parse(validRow)).not.toThrow();
  });

  it("service_id bigint (number) 필수 — 문자열 거부", () => {
    expect(() =>
      servicesRowSchema.parse({ ...validRow, service_id: "1234567" }),
    ).toThrow();
  });

  it("operator_email/developer_email nullable", () => {
    expect(() =>
      servicesRowSchema.parse({
        ...validRow,
        operator_email: null,
        developer_email: null,
      }),
    ).not.toThrow();
  });

  it("operator_name/developer_name nullable", () => {
    expect(() =>
      servicesRowSchema.parse({
        ...validRow,
        operator_name: null,
        developer_name: null,
      }),
    ).not.toThrow();
  });

  it("write_*/pay_* 날짜 nullable", () => {
    expect(() =>
      servicesRowSchema.parse({
        ...validRow,
        write_start_at: null,
        write_end_at: null,
        pay_start_at: null,
        pay_end_at: null,
      }),
    ).not.toThrow();
  });

  it("solo boolean — 문자열 거부", () => {
    expect(() =>
      servicesRowSchema.parse({ ...validRow, solo: "false" }),
    ).toThrow();
  });

  it("source 자유 텍스트 (1차 PR enum check 없음 — 후속 PR에서 도입)", () => {
    expect(() =>
      servicesRowSchema.parse({ ...validRow, source: "folio_create" }),
    ).not.toThrow();
    expect(() =>
      servicesRowSchema.parse({ ...validRow, source: "임의값" }),
    ).not.toThrow();
  });
});

describe("services/schemas — servicesCreateSchema", () => {
  const validCreate = {
    service_id: 7654321,
    application_type: "공통원서",
    region: "서울",
    university_name: "△△대학교",
    service_name: "2026 정시",
    university_type: "4년제",
    category: "정시",
    operator_email: null,
    operator_name: null,
    developer_email: null,
    developer_name: null,
    write_start_at: null,
    write_end_at: null,
    pay_start_at: null,
    pay_end_at: null,
    solo: false,
    source: "folio_create",
  };

  it("정상 create 통과", () => {
    expect(() => servicesCreateSchema.parse(validCreate)).not.toThrow();
  });

  it("service_id required — 누락 시 거부", () => {
    const _omit: Partial<typeof validCreate> = { ...validCreate };
    delete _omit.service_id;
    expect(() => servicesCreateSchema.parse(_omit)).toThrow();
  });

  it("university_name min 1 — 빈 문자열 거부", () => {
    expect(() =>
      servicesCreateSchema.parse({ ...validCreate, university_name: "" }),
    ).toThrow();
  });

  it("service_name min 1 — 빈 문자열 거부", () => {
    expect(() =>
      servicesCreateSchema.parse({ ...validCreate, service_name: "" }),
    ).toThrow();
  });

  it("solo default false 적용", () => {
    const _omit: Partial<typeof validCreate> = { ...validCreate };
    delete _omit.solo;
    const parsed = servicesCreateSchema.parse(_omit);
    expect(parsed.solo).toBe(false);
  });
});

describe("services/schemas — servicesUpdateSchema", () => {
  it("부분 업데이트 허용 (모든 필드 optional)", () => {
    expect(() =>
      servicesUpdateSchema.parse({ category: "정시" }),
    ).not.toThrow();
    expect(() => servicesUpdateSchema.parse({ solo: true })).not.toThrow();
    expect(() => servicesUpdateSchema.parse({})).not.toThrow();
  });

  it("solo boolean — 문자열 거부", () => {
    expect(() => servicesUpdateSchema.parse({ solo: "true" })).toThrow();
  });
});
