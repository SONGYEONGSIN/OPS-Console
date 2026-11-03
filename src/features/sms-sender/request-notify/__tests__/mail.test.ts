import { describe, expect, it } from "vitest";
import { buildRequestMail, itemDisplayUrl } from "../mail";
import type { RequestItem } from "../types";

const item = (over: Partial<RequestItem> = {}): RequestItem => ({
  id: "1",
  status: "요청",
  university: "서울예술대학교",
  kind: "수시",
  serviceId: "12345",
  title: "t",
  applicantEmail: "a@example.com",
  applicantName: "홍길동",
  webUrl: "https://example.sharepoint.com/lists/x/1",
  ...over,
});

const NOTICE =
  "이 메일은 SMS 발신번호 사전등록 신청 목록을 보고 자동으로 보냈습니다.";

describe("itemDisplayUrl", () => {
  it("_.000 항목 주소를 DispForm 으로 바꾼다", () => {
    expect(
      itemDisplayUrl("https://h.sharepoint.com/sites/S/Lists/SMS/35_.000"),
    ).toBe("https://h.sharepoint.com/sites/S/Lists/SMS/DispForm.aspx?ID=35");
  });
  it("모양이 다르면 그대로 둔다", () => {
    const u = "https://h.sharepoint.com/sites/S/Lists/SMS/AllItems.aspx";
    expect(itemDisplayUrl(u)).toBe(u);
  });
});

describe("buildRequestMail", () => {
  it("새 신청 제목", () => {
    expect(buildRequestMail("new", item()).subject).toBe(
      "[내부관리자] SMS 발신번호 사전등록 신청 — 서울예술대학교",
    );
  });
  it("완료 제목", () => {
    expect(buildRequestMail("done", item()).subject).toBe(
      "[내부관리자] SMS 발신번호 사전등록 완료 — 서울예술대학교",
    );
  });
  it("제목의 대학명 줄바꿈·연속 공백은 한 칸으로", () => {
    expect(
      buildRequestMail("new", item({ university: "서울\n예술  대학교" }))
        .subject,
    ).toBe("[내부관리자] SMS 발신번호 사전등록 신청 — 서울 예술 대학교");
  });
  it("본문은 값을 이스케이프한다", () => {
    const { html } = buildRequestMail(
      "new",
      item({ university: "<script>x</script>" }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("운영부 상황실 문구가 없다", () => {
    for (const k of ["new", "done"] as const) {
      const m = buildRequestMail(k, item());
      expect(m.subject).not.toContain("운영부 상황실");
      expect(m.html).not.toContain("운영부 상황실");
    }
  });
  it("고지 문구가 본문에 있다", () => {
    expect(buildRequestMail("new", item()).html).toContain(NOTICE);
    expect(buildRequestMail("done", item()).html).toContain(NOTICE);
  });
  it("https 가 아닌 webUrl 은 앵커를 만들지 않는다", () => {
    const { html } = buildRequestMail(
      "new",
      item({ webUrl: "javascript:alert(1)" }),
    );
    expect(html).not.toContain("<a ");
  });
  it("https webUrl 은 앵커를 만든다", () => {
    expect(buildRequestMail("new", item()).html).toContain('<a href="https://');
  });
  it("항목 webUrl(_.000)은 DispForm 주소로 바꿔 앵커에 넣는다", () => {
    const { html } = buildRequestMail(
      "new",
      item({ webUrl: "https://h.sharepoint.com/sites/S/Lists/SMS/35_.000" }),
    );
    expect(html).toContain(
      'href="https://h.sharepoint.com/sites/S/Lists/SMS/DispForm.aspx?ID=35"',
    );
  });
  it("모든 p·td·a 에 글꼴과 크기가 명시된다", () => {
    const { html } = buildRequestMail("new", item());
    const tags = html.match(/<(?:td|p|a)[\s>][^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toContain("'Malgun Gothic','맑은 고딕',Arial,sans-serif");
      expect(tag).toMatch(/font-size:\d+px/);
    }
  });
  it("새 신청 본문에 신청자 표시 이름, 완료 본문에는 없다", () => {
    expect(buildRequestMail("new", item()).html).toContain("홍길동");
    expect(buildRequestMail("done", item()).html).not.toContain("홍길동");
    expect(
      buildRequestMail("new", item({ applicantName: null })).html,
    ).toContain(">-<");
  });
  it("본문 첫 줄·안내 문구", () => {
    expect(buildRequestMail("new", item()).html).toContain(
      "SMS 발신번호 사전등록 신청이 들어왔습니다.",
    );
    expect(buildRequestMail("done", item()).html).toContain(
      "신청하신 SMS 발신번호 사전등록 처리가 완료됐습니다.",
    );
  });
});
