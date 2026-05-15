import { describe, it, expect } from "vitest";
import {
  backupRequestCreateSchema,
  backupRequestRowSchema,
  serviceDetailSchema,
  MAIL_STATUS_VALUES,
} from "../schemas";

// PR-3 — services는 {service_id, substitute_email?, substitute_name?}[] 튜플 배열
const baseInput = {
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services: [
    { service_id: "11111111-1111-4111-8111-111111111111" },
    { service_id: "22222222-2222-4222-8222-222222222222" },
  ],
  contacts: ["서울대", "연세대"],
  summary_md: "백업 요청 내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  requester_email: "bob@example.com",
};

describe("backupRequestCreateSchema", () => {
  it("정상 입력 통과 (services 튜플 배열, substitute 미지정 default fallback)", () => {
    const r = backupRequestCreateSchema.safeParse(baseInput);
    expect(r.success).toBe(true);
  });

  it("PR-3: 서비스별 substitute_email 명시 지정 통과", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [
        {
          service_id: "11111111-1111-4111-8111-111111111111",
          substitute_email: "x@example.com",
          substitute_name: "X",
        },
        {
          service_id: "22222222-2222-4222-8222-222222222222",
          substitute_email: "y@example.com",
          substitute_name: "Y",
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("uuid 형식이 아닌 service_id 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [{ service_id: "not-a-uuid" }],
    });
    expect(r.success).toBe(false);
  });

  it("빈 summary 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      summary_md: "",
    });
    expect(r.success).toBe(false);
  });

  it("self (substitute == requester) 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      substitute_email: baseInput.requester_email,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("백업자");
    }
  });

  it("end < start 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      leave_start_date: "2026-05-25",
      leave_end_date: "2026-05-20",
    });
    expect(r.success).toBe(false);
  });

  it("빈 services·contacts 허용", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [],
      contacts: [],
    });
    expect(r.success).toBe(true);
  });

  it("leave 날짜 둘 다 미입력 허용 (전사 휴가 외 케이스)", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      leave_start_date: null,
      leave_end_date: null,
    });
    expect(r.success).toBe(true);
  });

  it("services max 20 초과 거부", () => {
    const tooMany = Array.from({ length: 21 }, () => ({
      service_id: "11111111-1111-4111-8111-111111111111",
    }));
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: tooMany,
    });
    expect(r.success).toBe(false);
  });
});

describe("serviceDetailSchema", () => {
  it("정상 join row 파싱", () => {
    const r = serviceDetailSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      service_id: 5072006,
      service_name: "Graduate School of Police Studies",
      university_name: "경찰대학 대학원",
    });
    expect(r.success).toBe(true);
  });

  it("service_id 음수 거부", () => {
    const r = serviceDetailSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      service_id: -1,
      service_name: "x",
      university_name: "y",
    });
    expect(r.success).toBe(false);
  });
});

describe("backupRequestRowSchema", () => {
  it("정상 DB row 파싱 (services 없음 + services_detail 있음)", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      requester_email: "bob@example.com",
      requester_team: "ops",
      substitute_email: "alice@example.com",
      substitute_name: "Alice",
      services_detail: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          service_id: 5072006,
          service_name: "Graduate School of Police Studies",
          university_name: "경찰대학 대학원",
        },
      ],
      contacts: [],
      summary_md: "내용",
      leave_start_date: "2026-05-20",
      leave_end_date: "2026-05-25",
      mail_status: "pending",
      mail_sent_at: null,
      mail_error: null,
      created_at: "2026-05-13T00:00:00Z",
      updated_at: "2026-05-13T00:00:00Z",
    };
    const r = backupRequestRowSchema.safeParse(row);
    expect(r.success).toBe(true);
  });

  it("services_detail 누락 시 빈 배열 default", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      requester_email: "bob@example.com",
      requester_team: "ops",
      substitute_email: "alice@example.com",
      substitute_name: "Alice",
      contacts: [],
      summary_md: "내용",
      leave_start_date: null,
      leave_end_date: null,
      mail_status: "pending",
      mail_sent_at: null,
      mail_error: null,
      created_at: "2026-05-13T00:00:00Z",
      updated_at: "2026-05-13T00:00:00Z",
    };
    const r = backupRequestRowSchema.safeParse(row);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.services_detail).toEqual([]);
    }
  });
});

describe("MAIL_STATUS_VALUES", () => {
  it("4가지 상태 포함", () => {
    expect(MAIL_STATUS_VALUES).toEqual([
      "pending",
      "sent",
      "mail_failed",
      "dry_run",
    ]);
  });
});
