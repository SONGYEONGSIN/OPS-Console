import { describe, it, expect } from "vitest";
import { summarizeRatioAudit, buildRatioAuditHtml, SUMMARY_TOP_N } from "../summary";
import type { RatioAuditIngest, RatioFinding } from "../schemas";

function finding(id: number, university: string): RatioFinding {
  return {
    serviceId: id,
    universityName: university,
    serviceName: "수시",
    operatorName: "홍길동",
    items: [
      { type: "year", field: "top", found: "2025학년도", expect: "2026", quote: "2025학년도 경쟁률" },
    ],
  };
}

const base: RatioAuditIngest = {
  scannedCount: 231,
  findings: [],
  linkErrors: [],
  skipped: [],
};

describe("summarizeRatioAudit", () => {
  it("건수를 집계한다", () => {
    const s = summarizeRatioAudit({
      ...base,
      findings: [finding(1, "가대"), finding(2, "나대")],
      linkErrors: [{ serviceId: 3, url: "https://x.test/a.html", status: 404, reason: "" }],
    });
    expect(s).toEqual({
      scannedCount: 231,
      findingCount: 2,
      linkErrorCount: 1,
      status: "ok",
    });
  });

  it("건너뛴 서비스가 있으면 status는 partial", () => {
    const s = summarizeRatioAudit({
      ...base,
      skipped: [{ serviceId: 9, reason: "진입 실패" }],
    });
    expect(s.status).toBe("partial");
  });
});

describe("buildRatioAuditHtml", () => {
  it("이상 0건이면 이상 없음 문구", () => {
    const html = buildRatioAuditHtml(base);
    expect(html).toContain("이상 없음");
    expect(html).not.toContain("<table");
  });

  it("헤더에 순회·이상·링크오류 건수를 담는다", () => {
    const html = buildRatioAuditHtml({
      ...base,
      findings: [finding(1, "가대")],
      linkErrors: [{ serviceId: 3, url: "https://x.test/a.html", status: 404, reason: "" }],
    });
    expect(html).toContain("순회 231");
    expect(html).toContain("이상 1");
    expect(html).toContain("링크오류 1");
  });

  it("이상 건은 대학·서비스·담당자·발견값을 표로 낸다", () => {
    const html = buildRatioAuditHtml({ ...base, findings: [finding(1, "성신여자대학교")] });
    expect(html).toContain("<table");
    expect(html).toContain("성신여자대학교");
    expect(html).toContain("홍길동");
    expect(html).toContain("2025학년도");
  });

  it(`상위 ${SUMMARY_TOP_N}건만 표에 넣고 나머지는 '외 N건'으로 줄인다`, () => {
    const many = Array.from({ length: SUMMARY_TOP_N + 3 }, (_, i) => finding(i + 1, `대학${i + 1}`));
    const html = buildRatioAuditHtml({ ...base, findings: many });
    expect(html).toContain(`대학${SUMMARY_TOP_N}`);
    expect(html).not.toContain(`대학${SUMMARY_TOP_N + 1}`);
    expect(html).toContain("외 3건");
  });

  it("HTML 특수문자를 이스케이프한다", () => {
    const f = finding(1, "가대");
    f.items[0].found = '<script>alert("x")</script>';
    const html = buildRatioAuditHtml({ ...base, findings: [f] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
