import { describe, it, expect } from "vitest";
import {
  buildServiceNoticeSubject,
  buildServiceNoticeHtml,
} from "../mail-template";
import type { ServiceNoticeGroup } from "../schemas";

const group: ServiceNoticeGroup = {
  operator: { email: "kim@x.com", name: "김운영" },
  services: [
    {
      id: "1",
      universityName: "가천대",
      serviceName: "수시모집",
      universityType: "4년제",
      category: "공통원서",
      operatorEmail: "kim@x.com",
      operatorName: "김운영",
      writeStartAt: "2026-05-31T15:00:00Z", // 2026-06-01 KST
      writeEndAt: "2026-06-09T15:00:00Z",
      payStartAt: "2026-06-01T15:00:00Z",
      payEndAt: "2026-06-10T15:00:00Z",
    },
    {
      id: "2",
      universityName: "고려대",
      serviceName: "정시모집",
      universityType: "4년제",
      category: "공공접수",
      operatorEmail: "kim@x.com",
      operatorName: "김운영",
      writeStartAt: "2026-06-04T15:00:00Z",
      writeEndAt: null,
      payStartAt: null,
      payEndAt: null,
    },
  ],
};

describe("buildServiceNoticeSubject", () => {
  it("운영부 상황실 prefix + N월", () => {
    expect(buildServiceNoticeSubject(6)).toBe(
      "[운영부 상황실] 원서접수 일정 확인 알림 (6월)",
    );
  });
});

describe("buildServiceNoticeHtml", () => {
  it("운영자명 + 대학/서비스 + 카테고리 섹션 + 로고 cid + 날짜", () => {
    const html = buildServiceNoticeHtml(group, 6);
    expect(html).toContain("김운영");
    expect(html).toContain("가천대");
    expect(html).toContain("수시모집");
    expect(html).toContain("고려대");
    expect(html).toContain("공통원서");
    expect(html).toContain("공공접수");
    expect(html).toContain('src="cid:opslogo"');
    expect(html).toContain("2026.06.01"); // writeStartAt KST
  });

  it("XSS — 대학명 escape", () => {
    const evil: ServiceNoticeGroup = {
      ...group,
      services: [{ ...group.services[0], universityName: "<script>x</script>" }],
    };
    const html = buildServiceNoticeHtml(evil, 6);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
