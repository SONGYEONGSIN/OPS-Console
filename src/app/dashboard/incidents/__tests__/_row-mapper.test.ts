import { describe, it, expect } from "vitest";
import { incidentToListRow } from "../_row-mapper";
import type { IncidentRow } from "@/features/incidents/schemas";

const base: IncidentRow = {
  id: crypto.randomUUID(),
  year: 2026,
  university_name: "건국대학교",
  app_type: "공통원서",
  category: "결제",
  occurred_date: "2026-06-01",
  resolved_date: null,
  title: "결제 오류",
  cause_summary: "PG 장애",
  root_cause: null,
  resolution: null,
  prevention: null,
  department: "운영부-운영1팀",
  assignee_email: "me@x.com",
  assignee_name: "나",
  reporter_email: "r@x.com",
  reporter_name: "보고자",
  status: "처리중",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

describe("incidentToListRow", () => {
  it("기본 필드 매핑 + 경위서 상태 미지정 시 undefined", () => {
    const row = incidentToListRow(base);
    expect(row.id).toBe(base.id);
    expect(row.incidentTitle).toBe("결제 오류");
    expect(row.incidentStatus).toBe("처리중");
    expect(row.incidentReportStatus).toBeUndefined();
  });

  it("reportStatus 전달 시 incidentReportStatus 세팅", () => {
    expect(incidentToListRow(base, "pending_approval").incidentReportStatus).toBe(
      "pending_approval",
    );
    expect(incidentToListRow(base, "sent").incidentReportStatus).toBe("sent");
  });
});
