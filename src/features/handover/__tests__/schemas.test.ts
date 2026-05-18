import { describe, it, expect } from "vitest";
import {
  handoverRecordRowSchema,
  handoverRecordUpsertSchema,
  STATUS_VALUES,
} from "../schemas";

describe("STATUS_VALUES", () => {
  it("draft / ready / published 3값", () => {
    expect(STATUS_VALUES).toEqual(["draft", "ready", "published"]);
  });
});

describe("handoverRecordRowSchema", () => {
  const baseRow = {
    id: "11111111-1111-4111-8111-111111111111",
    service_id: "22222222-2222-4222-8222-222222222222",
    contract_info_md: null,
    contract_data_md: null,
    work_basic_md: null,
    work_generator_md: null,
    work_site_md: null,
    work_output_md: null,
    work_rate_md: null,
    work_file_md: null,
    work_etc_md: null,
    payment_fee_md: null,
    payment_invoice_md: null,
    school_contact_md: null,
    docs_md: null,
    notes_md: null,
    author_email: "bob@example.com",
    author_name: "Bob",
    status: "draft",
    created_at: "2026-05-16T00:00:00Z",
    updated_at: "2026-05-16T00:00:00Z",
  };

  it("정상 row 파싱 — 14 필드 모두 null 허용", () => {
    const r = handoverRecordRowSchema.safeParse(baseRow);
    expect(r.success).toBe(true);
  });

  it("status enum 외 값 거부", () => {
    const r = handoverRecordRowSchema.safeParse({ ...baseRow, status: "wat" });
    expect(r.success).toBe(false);
  });

  it("필드에 long markdown 보존", () => {
    const md = "[사고 내용]\n- 한 줄\n- 두 줄";
    const r = handoverRecordRowSchema.safeParse({
      ...baseRow,
      work_basic_md: md,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.work_basic_md).toBe(md);
  });

  it("필드 10000자 초과 거부", () => {
    const md = "a".repeat(10001);
    const r = handoverRecordRowSchema.safeParse({
      ...baseRow,
      work_basic_md: md,
    });
    expect(r.success).toBe(false);
  });
});

describe("handoverRecordUpsertSchema", () => {
  it("service_id만 — 14 필드 모두 미지정 통과", () => {
    const r = handoverRecordUpsertSchema.safeParse({
      service_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(true);
  });

  it("service_id uuid 외 형식 거부", () => {
    const r = handoverRecordUpsertSchema.safeParse({
      service_id: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("필드 1개 채움 + 나머지 null 통과", () => {
    const r = handoverRecordUpsertSchema.safeParse({
      service_id: "22222222-2222-4222-8222-222222222222",
      work_basic_md: "기초 내용",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.work_basic_md).toBe("기초 내용");
  });
});
