import { describe, it, expect } from "vitest";
import { buildReportStatusMap } from "../queries";

describe("buildReportStatusMap", () => {
  it("빈 입력 → 빈 맵", () => {
    expect(buildReportStatusMap([])).toEqual({});
  });

  it("incident_id → status 매핑", () => {
    const map = buildReportStatusMap([
      { incident_id: "a", status: "draft" },
      { incident_id: "b", status: "approved" },
      { incident_id: "c", status: "sent" },
    ]);
    expect(map).toEqual({ a: "draft", b: "approved", c: "sent" });
  });

  it("incident_id null 행은 제외", () => {
    const map = buildReportStatusMap([
      { incident_id: null, status: "draft" },
      { incident_id: "b", status: "pending_approval" },
    ]);
    expect(map).toEqual({ b: "pending_approval" });
  });

  it("중복 incident_id는 마지막 값으로 덮어씀", () => {
    const map = buildReportStatusMap([
      { incident_id: "a", status: "draft" },
      { incident_id: "a", status: "approved" },
    ]);
    expect(map).toEqual({ a: "approved" });
  });
});
