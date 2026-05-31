import { describe, it, expect } from "vitest";
import { groupServicesByOperator } from "../grouping";
import type { ServiceNoticeService } from "../schemas";

function svc(p: Partial<ServiceNoticeService>): ServiceNoticeService {
  return {
    id: p.id ?? "id",
    universityName: p.universityName ?? "대학",
    serviceName: p.serviceName ?? "서비스",
    universityType: p.universityType ?? "4년제",
    category: p.category ?? "공통원서",
    operatorEmail: p.operatorEmail ?? "a@x.com",
    operatorName: "operatorName" in p ? (p.operatorName ?? null) : "운영A",
    writeStartAt: p.writeStartAt ?? "2026-06-01T00:00:00Z",
    writeEndAt: p.writeEndAt ?? null,
    payStartAt: p.payStartAt ?? null,
    payEndAt: p.payEndAt ?? null,
  };
}

describe("groupServicesByOperator", () => {
  it("운영자 이메일별로 묶고 writeStartAt 오름차순 정렬", () => {
    const groups = groupServicesByOperator([
      svc({ id: "1", operatorEmail: "a@x.com", writeStartAt: "2026-06-10T00:00:00Z" }),
      svc({ id: "2", operatorEmail: "b@x.com", writeStartAt: "2026-06-05T00:00:00Z" }),
      svc({ id: "3", operatorEmail: "a@x.com", writeStartAt: "2026-06-02T00:00:00Z" }),
    ]);
    const a = groups.find((g) => g.operator.email === "a@x.com")!;
    expect(a.services.map((s) => s.id)).toEqual(["3", "1"]);
    const b = groups.find((g) => g.operator.email === "b@x.com")!;
    expect(b.services.map((s) => s.id)).toEqual(["2"]);
  });

  it("operatorEmail 없으면 제외, operatorName 없으면 이메일로 폴백", () => {
    const groups = groupServicesByOperator([
      svc({ id: "1", operatorEmail: "", operatorName: null }),
      svc({ id: "2", operatorEmail: "c@x.com", operatorName: null }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].operator.email).toBe("c@x.com");
    expect(groups[0].operator.name).toBe("c@x.com");
  });
});
