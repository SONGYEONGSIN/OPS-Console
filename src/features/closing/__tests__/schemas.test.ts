import { describe, it, expect } from "vitest";
import { closingIngestSchema, closingRowSchema } from "../schemas";

const validRow = {
  service_id: 1234567,
  university_name: "○○대학교",
  region: "서울",
  service_name: "2026 수시 원서접수",
  university_type: "4년제",
  category: "수시",
  operator_name: "박운영",
  developer_name: "김개발",
  write_start_at: "2026-03-01T00:01:00+09:00",
  write_end_at: "2026-09-15T18:00:00+09:00",
  solo: false,
};

describe("closingRowSchema", () => {
  it("정상 row 통과", () => {
    expect(closingRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("nullable 컬럼 — region/operator_name 등 null 허용", () => {
    const r = closingRowSchema.safeParse({
      ...validRow,
      region: null,
      operator_name: null,
      developer_name: null,
      write_start_at: null,
    });
    expect(r.success).toBe(true);
  });

  it("write_end_at 누락 거부 (마감 필터 기준 필수)", () => {
    const { write_end_at: _omit, ...withoutEnd } = validRow;
    void _omit;
    expect(closingRowSchema.safeParse(withoutEnd).success).toBe(false);
  });

  it("service_id 음수/0 거부", () => {
    expect(closingRowSchema.safeParse({ ...validRow, service_id: 0 }).success).toBe(
      false,
    );
  });

  it("write_end_at offset 없는 datetime 거부", () => {
    expect(
      closingRowSchema.safeParse({
        ...validRow,
        write_end_at: "2026-09-15T18:00:00",
      }).success,
    ).toBe(false);
  });
});

describe("closingIngestSchema", () => {
  it("정상 payload 통과", () => {
    const r = closingIngestSchema.safeParse({
      scraped_at: "2026-06-07T10:00:00+09:00",
      rows: [validRow],
    });
    expect(r.success).toBe(true);
  });

  it("rows 빈 배열 거부 (전체 삭제 사고 방지)", () => {
    const r = closingIngestSchema.safeParse({
      scraped_at: "2026-06-07T10:00:00+09:00",
      rows: [],
    });
    expect(r.success).toBe(false);
  });

  it("scraped_at 누락 거부", () => {
    const r = closingIngestSchema.safeParse({ rows: [validRow] });
    expect(r.success).toBe(false);
  });
});
