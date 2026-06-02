import { describe, it, expect } from "vitest";
import {
  incidentReportCreateSchema,
  reportStatusSchema,
  incidentReportSendSchema,
} from "../schemas";

const SAMPLE_UUID = crypto.randomUUID();

describe("incidentReportCreateSchema", () => {
  it("최소 필드(incident_id/제목/수신대학)로 통과", () => {
    const r = incidentReportCreateSchema.safeParse({
      incident_id: SAMPLE_UUID,
      recipient_university: "건국대학교",
      title: "전산파일 오류 건",
    });
    expect(r.success).toBe(true);
  });
  it("incident_id 누락 시 실패 (경위서는 항상 사고에서 생성)", () => {
    const r = incidentReportCreateSchema.safeParse({
      recipient_university: "건국대학교",
      title: "전산파일 오류 건",
    });
    expect(r.success).toBe(false);
  });
  it("제목 누락 시 실패", () => {
    const r = incidentReportCreateSchema.safeParse({
      incident_id: SAMPLE_UUID,
      recipient_university: "x",
    });
    expect(r.success).toBe(false);
  });
  it("status enum 5종", () => {
    for (const s of ["draft", "pending_approval", "approved", "rejected", "sent"]) {
      expect(reportStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(reportStatusSchema.safeParse("xxx").success).toBe(false);
  });
});

describe("incidentReportSendSchema", () => {
  it("수신 이메일 1개 이상 필요", () => {
    expect(
      incidentReportSendSchema.safeParse({ id: SAMPLE_UUID, recipient_emails: [] }).success,
    ).toBe(false);
    expect(
      incidentReportSendSchema.safeParse({ id: SAMPLE_UUID, recipient_emails: ["a@b.com"] })
        .success,
    ).toBe(true);
  });
});
