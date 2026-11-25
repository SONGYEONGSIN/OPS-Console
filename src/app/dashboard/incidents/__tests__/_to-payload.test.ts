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

  it("처리 행(incidentHandlingRows)을 handling_rows로 매핑한다", () => {
    const rows = [{ time: "06.02", content: "확인" }];
    expect(
      toIncidentPayload({ ...base, incidentHandlingRows: rows }, 2026)
        .handling_rows,
    ).toEqual(rows);
  });

  it("처리 행이 없으면 빈 배열", () => {
    expect(toIncidentPayload(base, 2026).handling_rows).toEqual([]);
  });
});

describe("toIncidentPayload — 사고 등급", () => {
  it("incidentSeverity 를 severity 로 매핑한다", () => {
    expect(
      toIncidentPayload({ ...base, incidentSeverity: "보통" }, 2026).severity,
    ).toBe("보통");
  });

  it("값이 없으면 키는 있어도 undefined — update 스키마가 null 을 거부하므로", () => {
    expect(toIncidentPayload(base, 2026).severity).toBeUndefined();
  });

  it("기존 NULL 행 수정도 null 이 아니라 undefined", () => {
    expect(
      toIncidentPayload({ ...base, incidentSeverity: null }, 2026).severity,
    ).toBeUndefined();
  });
});
