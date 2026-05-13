import { describe, it, expect } from "vitest";
import {
  backupRequestCreateSchema,
  backupRequestRowSchema,
  MAIL_STATUS_VALUES,
} from "../schemas";

const baseInput = {
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services: ["서비스1", "서비스2"],
  contacts: ["서울대", "연세대"],
  summary_md: "백업 요청 내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  requester_email: "bob@example.com",
};

describe("backupRequestCreateSchema", () => {
  it("정상 입력 통과", () => {
    const r = backupRequestCreateSchema.safeParse(baseInput);
    expect(r.success).toBe(true);
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
});

describe("backupRequestRowSchema", () => {
  it("정상 DB row 파싱", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      requester_email: "bob@example.com",
      requester_team: "ops",
      substitute_email: "alice@example.com",
      substitute_name: "Alice",
      services: ["서비스1"],
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
