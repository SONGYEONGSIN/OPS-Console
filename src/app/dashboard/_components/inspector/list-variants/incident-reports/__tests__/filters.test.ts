import { describe, it, expect } from "vitest";
import {
  INCIDENT_REPORT_FILTERS,
  blankIncidentReportRow,
} from "../filters";

describe("incident-reports filters", () => {
  it("INCIDENT_REPORT_FILTERS는 빈 배열 (chip 미노출)", () => {
    expect(INCIDENT_REPORT_FILTERS).toEqual([]);
  });

  it("blankIncidentReportRow는 신규 draft 행을 만든다", () => {
    const row = blankIncidentReportRow({ currentUserName: "송영신" });
    expect(row.id).toBe("");
    expect(row.status).toBe("active");
    expect(row.incidentReportStatus).toBe("draft");
    expect(row.incidentReportTitle).toBe("");
    expect(row.incidentReportUniversity).toBe("");
    expect(row.incidentReportAuthorName).toBe("송영신");
    expect(row.name).toBe("");
  });

  it("currentUserName 미지정 시 작성자 빈 문자열", () => {
    const row = blankIncidentReportRow();
    expect(row.incidentReportAuthorName).toBe("");
  });
});
