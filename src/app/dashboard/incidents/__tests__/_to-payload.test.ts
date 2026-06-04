import { describe, it, expect } from "vitest";
import { toIncidentPayload } from "../_to-payload";
import type { ListRow } from "../../_components/patterns/ListPattern";

const base: ListRow = {
  id: "x",
  name: "사고",
  status: "active",
  owner: "me",
  incidentUniversityName: "건국대학교",
};

describe("toIncidentPayload", () => {
  it("서비스명(incidentServiceName)을 service_name으로 매핑한다 (회귀: 저장 누락 버그)", () => {
    const p = toIncidentPayload(
      { ...base, incidentServiceName: "수시모집" },
      2026,
    );
    expect(p.service_name).toBe("수시모집");
  });

  it("서비스명이 없으면 service_name은 null", () => {
    expect(toIncidentPayload(base, 2026).service_name).toBeNull();
  });

  it("year 미지정 시 fallbackYear를 사용한다", () => {
    expect(toIncidentPayload(base, 2026).year).toBe(2026);
  });

  it("대학명을 university_name으로 매핑한다", () => {
    expect(toIncidentPayload(base, 2026).university_name).toBe("건국대학교");
  });
});
