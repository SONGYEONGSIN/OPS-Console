import { describe, it, expect } from "vitest";
import { buildBackupRequestHtmlDocument } from "../html-document";

const base = {
  requesterName: "송영신",
  requesterEmail: "req@x.com",
  substituteName: "윤지혜",
  substituteEmail: "sub@x.com",
  leaveStartDate: "2026-07-15",
  leaveEndDate: "2026-07-20",
  services: [
    {
      id: "s1",
      service_id: 1210065,
      service_name: "외국인 신입학",
      university_name: "부산대학교",
      contacts: [
        {
          contact_id: "c1",
          customer_name: "최열",
          university_name: "부산대학교",
          email: "choi@bnu.ac.kr",
          phone: "051-000",
          ext: "123",
        },
      ],
      note_md: "서비스 특이사항",
    },
  ],
  summaryMd: "전체 요약 메모",
  createdAt: "2026-07-10T00:00:00Z",
};

describe("buildBackupRequestHtmlDocument", () => {
  it("HTML 문서 골격 + 핵심 정보 포함", () => {
    const html = buildBackupRequestHtmlDocument(base);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("백업 요청");
    expect(html).toContain("송영신");
    expect(html).toContain("윤지혜");
    expect(html).toContain("2026-07-15 ~ 2026-07-20");
  });

  it("서비스·연락처·메모·요약 표시", () => {
    const html = buildBackupRequestHtmlDocument(base);
    expect(html).toContain("부산대학교");
    expect(html).toContain("외국인 신입학");
    expect(html).toContain("최열");
    expect(html).toContain("서비스 특이사항");
    expect(html).toContain("전체 요약 메모");
  });

  it("HTML 이스케이프 (XSS 방지)", () => {
    const html = buildBackupRequestHtmlDocument({
      ...base,
      requesterName: "<script>x</script>",
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("서비스 없으면 빈 안내", () => {
    const html = buildBackupRequestHtmlDocument({ ...base, services: [] });
    expect(html).toContain("<!DOCTYPE html>");
  });
});
