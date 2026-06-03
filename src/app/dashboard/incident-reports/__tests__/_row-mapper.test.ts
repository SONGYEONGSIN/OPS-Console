import { describe, it, expect } from "vitest";
import { incidentReportToListRow } from "../_row-mapper";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

const sample: IncidentReportRow = {
  id: "11111111-1111-1111-1111-111111111111",
  incident_id: "22222222-2222-2222-2222-222222222222",
  recipient_university: "진학대학교",
  title: "결제 오류 경위서",
  draft_date: "2026-06-01",
  gyeongwi: "결제 과정에서 오류 발생",
  cause: "DB 커넥션 풀 소진",
  handling: "풀 재시작 및 모니터링",
  handling_rows: [],
  prevention: "임계치 알림 추가",
  apology: "불편을 끼쳐 죄송합니다.",
  author_name: "송영신",
  author_email: "ys@example.com",
  approver_name: "허승철",
  approver_email: "hsc@example.com",
  approver_role: "팀장",
  director_name: "본부장",
  director_role: "본부장",
  ceo_name: "사장",
  ceo_role: "사장",
  status: "pending_approval",
  reject_reason: null,
  approved_at: null,
  recipient_emails: [],
  doc_number: "OPS-2026-001",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

describe("incidentReportToListRow", () => {
  it("IncidentReportRow를 ListRow incidentReport* 필드로 매핑한다", () => {
    const row = incidentReportToListRow(sample);

    expect(row.id).toBe(sample.id);
    expect(row.name).toBe("결제 오류 경위서");
    expect(row.incidentReportTitle).toBe("결제 오류 경위서");
    expect(row.incidentReportUniversity).toBe("진학대학교");
    expect(row.incidentReportStatus).toBe("pending_approval");
    expect(row.incidentReportAuthorName).toBe("송영신");
    expect(row.incidentReportAuthorEmail).toBe("ys@example.com");
    expect(row.incidentReportApproverName).toBe("허승철");
    expect(row.incidentReportApproverEmail).toBe("hsc@example.com");
    expect(row.incidentReportDirectorName).toBe("본부장");
    expect(row.incidentReportCeoName).toBe("사장");
    expect(row.incidentReportGyeongwi).toBe("결제 과정에서 오류 발생");
    expect(row.incidentReportCause).toBe("DB 커넥션 풀 소진");
    expect(row.incidentReportHandling).toBe("풀 재시작 및 모니터링");
    expect(row.incidentReportPrevention).toBe("임계치 알림 추가");
    expect(row.incidentReportApology).toBe("불편을 끼쳐 죄송합니다.");
    expect(row.incidentReportRejectReason).toBeNull();
    expect(row.incidentReportIncidentId).toBe(sample.incident_id);
    expect(row.incidentReportDraftDate).toBe("2026-06-01");
  });

  it("status는 항상 active (목록 필터 무관) — 결재상태는 incidentReportStatus", () => {
    const row = incidentReportToListRow(sample);
    expect(row.status).toBe("active");
  });
});
