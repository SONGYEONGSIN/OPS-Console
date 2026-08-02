import { describe, it, expect } from "vitest";
import { ratioAuditIngestSchema } from "../schemas";

const valid = {
  scannedCount: 2,
  findings: [
    {
      serviceId: 1093020,
      universityName: "성신여자대학교",
      serviceName: "수시",
      operatorName: "김지영",
      items: [
        {
          type: "year",
          field: "top",
          found: "2025학년도",
          expect: "2026",
          quote: "2025학년도 경쟁률은",
        },
      ],
    },
  ],
  linkErrors: [
    { serviceId: 1093020, url: "https://addon.jinhakapply.com/a.html", status: 404, reason: "" },
  ],
  skipped: [{ serviceId: 1130056, reason: "설정 페이지 진입 실패" }],
};

describe("ratioAuditIngestSchema", () => {
  it("정상 payload 통과", () => {
    const parsed = ratioAuditIngestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("이상 0건 payload도 통과 (빈 배열 허용)", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      scannedCount: 10,
      findings: [],
      linkErrors: [],
      skipped: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("quote·reason 누락 시 빈 문자열로 채운다", () => {
    const parsed = ratioAuditIngestSchema.parse({
      scannedCount: 1,
      findings: [
        {
          serviceId: 1,
          universityName: "가대",
          serviceName: "수시",
          operatorName: "홍길동",
          items: [{ type: "schedule", field: "pre_open", found: "9월 7일", expect: "9월 8일" }],
        },
      ],
      linkErrors: [{ serviceId: 1, url: "https://x.test/a.html", status: 0 }],
      skipped: [],
    });
    expect(parsed.findings[0].items[0].quote).toBe("");
    expect(parsed.linkErrors[0].reason).toBe("");
  });

  it("items 빈 배열인 finding은 거부 (이상 없으면 finding 자체를 넣지 않는다)", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      ...valid,
      findings: [{ ...valid.findings[0], items: [] }],
    });
    expect(parsed.success).toBe(false);
  });

  it("알 수 없는 type은 거부", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      ...valid,
      findings: [
        { ...valid.findings[0], items: [{ ...valid.findings[0].items[0], type: "typo" }] },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("scannedCount 음수는 거부", () => {
    const parsed = ratioAuditIngestSchema.safeParse({ ...valid, scannedCount: -1 });
    expect(parsed.success).toBe(false);
  });

  it("linkErrors의 status 음수는 거부", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      ...valid,
      linkErrors: [{ ...valid.linkErrors[0], status: -1 }],
    });
    expect(parsed.success).toBe(false);
  });
});
