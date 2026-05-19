import { describe, it, expect } from "vitest";
import { servicesRowToListRow } from "../_row-mapper";
import type { ServicesRow } from "@/features/services/schemas";

const sampleRow: ServicesRow = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: 1234,
  application_type: "공통원서",
  region: "서울",
  university_name: "○○대학교",
  service_name: "2026 수시",
  university_type: "4년제",
  category: "수시",
  operator_email: "op@x.com",
  operator_name: "박운영",
  developer_email: null,
  developer_name: null,
  write_start_at: "2026-08-01T00:00:00Z",
  write_end_at: "2026-09-15T00:00:00Z",
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
  source: "google_sheet_import",
  imported_at: "2026-05-13T00:00:00Z",
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
};

describe("servicesRowToListRow", () => {
  it("ServicesRow 핵심 필드를 ListRow로 매핑", () => {
    const r = servicesRowToListRow(sampleRow);
    expect(r.id).toBe(sampleRow.id);
    expect(r.name).toBe("2026 수시");
    expect(r.universityName).toBe("○○대학교");
    expect(r.writeStartAt).toBe(sampleRow.write_start_at);
    expect(r.solo).toBe(false);
    expect(r.status).toBe("active");
  });

  it("operator_name 없으면 operator_email fallback, 둘 다 없으면 '-'", () => {
    expect(
      servicesRowToListRow({ ...sampleRow, operator_name: null }).owner,
    ).toBe("op@x.com");
    expect(
      servicesRowToListRow({
        ...sampleRow,
        operator_name: null,
        operator_email: null,
      }).owner,
    ).toBe("-");
  });
});
