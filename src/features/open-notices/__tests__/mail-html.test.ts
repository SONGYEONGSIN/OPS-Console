import { describe, it, expect } from "vitest";
import { htmlifyOpenNoticeBody, buildOpenNoticeHtml } from "../mail-html";

describe("htmlifyOpenNoticeBody — 공백 보존", () => {
  it("콜론 정렬용 연속 공백이 살아남는다", () => {
    // HTML 은 연속 공백을 1칸으로 접는다. 그대로 두면 받은 편지함에서
    // '· 대학명   :' 과 '· 모집구분 :' 의 콜론이 어긋난다.
    expect(htmlifyOpenNoticeBody("· 대학명   : 조선대학교")).toBe(
      "· 대학명&nbsp;&nbsp;&nbsp;: 조선대학교",
    );
  });

  it("단일 공백은 그대로 둔다 — 좁은 화면에서 줄바꿈이 살아야 한다", () => {
    expect(htmlifyOpenNoticeBody("문의사항은 아래 연락처로")).toBe(
      "문의사항은 아래 연락처로",
    );
  });

  it("선두 들여쓰기가 살아남는다", () => {
    expect(htmlifyOpenNoticeBody("   └ 접수현황")).toBe(
      "&nbsp;&nbsp;&nbsp;└ 접수현황",
    );
  });

  it("줄바꿈은 <br> 이 된다", () => {
    expect(htmlifyOpenNoticeBody("가\n나")).toBe("가<br>나");
  });

  it("HTML 특수문자를 이스케이프한다", () => {
    expect(htmlifyOpenNoticeBody("<script>&\"'")).toBe(
      "&lt;script&gt;&amp;&quot;&#39;",
    );
  });

  it("이스케이프가 만든 엔티티를 다시 건드리지 않는다", () => {
    // &amp; 를 재처리해 &amp;nbsp; 가 되면 본문에 리터럴이 보인다
    const out = htmlifyOpenNoticeBody("A & B");
    expect(out).toBe("A &amp; B");
    expect(out).not.toContain("&amp;nbsp;");
  });
});

describe("htmlifyOpenNoticeBody — URL 링크", () => {
  it("URL 을 앵커로 감싼다", () => {
    expect(
      htmlifyOpenNoticeBody("https://apply.jinhakapply.com/Notice/1130058/A"),
    ).toBe(
      '<a href="https://apply.jinhakapply.com/Notice/1130058/A">https://apply.jinhakapply.com/Notice/1130058/A</a>',
    );
  });

  it("줄 안에 섞인 URL 도 감싸고 앞쪽 정렬 공백은 유지한다", () => {
    const out = htmlifyOpenNoticeBody("· 접수주소  : https://x.test/a");
    expect(out).toBe(
      '· 접수주소&nbsp;&nbsp;: <a href="https://x.test/a">https://x.test/a</a>',
    );
  });

  it("URL 뒤에 연속 공백이 와도 URL 에 먹히지 않는다", () => {
    const out = htmlifyOpenNoticeBody("https://x.test/a  끝");
    expect(out).toBe(
      '<a href="https://x.test/a">https://x.test/a</a>&nbsp;&nbsp;끝',
    );
  });

  it("앵커 태그 자체는 이스케이프되지 않는다", () => {
    expect(htmlifyOpenNoticeBody("https://x.test/a")).not.toContain("&lt;a href");
  });

  it("URL 이 없으면 앵커도 없다", () => {
    expect(htmlifyOpenNoticeBody("감사합니다.")).toBe("감사합니다.");
  });

  it("href 에 들어가는 URL 도 이스케이프한다", () => {
    const out = htmlifyOpenNoticeBody('https://x.test/a"onmouseover=alert(1)');
    expect(out).not.toContain('"onmouseover');
    expect(out).toContain("&quot;");
  });
});

describe("buildOpenNoticeHtml", () => {
  it("본문 + 서명을 div 로 감싼다", () => {
    const html = buildOpenNoticeHtml("· 대학명   : 조선대학교", {
      name: "홍길동",
      department: "운영부",
      team: "1팀",
      role: "매니저",
      phone: "02-000-0000",
    });
    expect(html.startsWith("<div>")).toBe(true);
    expect(html.endsWith("</div>")).toBe(true);
    expect(html).toContain("&nbsp;&nbsp;&nbsp;:");
    expect(html).toContain("홍길동");
    expect(html).toContain("(주)진학어플라이");
  });

  it("서명 정보가 없어도 본문은 나간다", () => {
    const html = buildOpenNoticeHtml("본문", {});
    expect(html).toContain("본문");
    expect(html).toContain("(주)진학어플라이");
  });
});
