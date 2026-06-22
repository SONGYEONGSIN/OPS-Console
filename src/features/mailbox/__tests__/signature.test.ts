import { describe, it, expect } from "vitest";
import {
  htmlEscape,
  htmlifyBody,
  buildHtmlSignature,
  buildReplyHtml,
  type OperatorSig,
} from "../signature";

const FULL: OperatorSig = {
  name: "송영신",
  department: "운영부",
  team: "운영2팀",
  role: "팀장",
  phone: "(02)2013-0669",
};

describe("htmlEscape", () => {
  it("& < > \" ' 를 엔티티로 이스케이프", () => {
    expect(htmlEscape(`<script>"a"&'b'`)).toBe(
      "&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;",
    );
  });

  it("& 를 먼저 이스케이프해 이중 이스케이프 방지", () => {
    expect(htmlEscape("a&b")).toBe("a&amp;b");
    expect(htmlEscape("<>")).toBe("&lt;&gt;");
  });
});

describe("htmlifyBody", () => {
  it("이스케이프 후 \\n 을 <br> 로 변환", () => {
    expect(htmlifyBody("안녕하세요\n반갑습니다")).toBe(
      "안녕하세요<br>반갑습니다",
    );
  });

  it("본문 내 HTML 특수문자 이스케이프", () => {
    expect(htmlifyBody("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("buildHtmlSignature", () => {
  it("전체 필드 — 첫 줄 공백 2칸, T.|F., 링크 4개 anchor", () => {
    const sig = buildHtmlSignature(FULL);
    // 첫 줄: 회사명 + 공백 2칸 + 부서 팀 | 역할
    expect(sig).toContain("(주)진학어플라이&nbsp;&nbsp;운영부 운영2팀 | 팀장");
    expect(sig).toContain("송영신");
    expect(sig).toContain(
      "서울특별시 종로구 경희궁길 34 (진학기획B/D 3F)",
    );
    expect(sig).toContain("T. (02)2013-0669 | F. 02-730-0517");
    // 링크 4개 정확한 URL + anchor 라벨
    expect(sig).toContain(
      '<a href="https://www.jinhakapply.com/">원서접수</a>',
    );
    expect(sig).toContain('<a href="https://www.jinhak.com/">진학닷컴</a>');
    expect(sig).toContain('<a href="https://www.catch.co.kr/">CATCH</a>');
    expect(sig).toContain(
      '<a href="https://www.jinhakpro.com/">JINHAKPRO(전임·강사·연구원채용)</a>',
    );
    // 링크는 ' | ' 로 구분
    expect(sig).toContain("</a> | <a ");
  });

  it("phone 없으면 T. 부분 생략, F.만 남음", () => {
    const sig = buildHtmlSignature({ ...FULL, phone: null });
    expect(sig).not.toContain("T.");
    expect(sig).toContain("F. 02-730-0517");
  });

  it("role 없으면 | 역할 생략", () => {
    const sig = buildHtmlSignature({ ...FULL, role: null });
    expect(sig).toContain("(주)진학어플라이&nbsp;&nbsp;운영부 운영2팀");
    expect(sig).not.toContain(" | 팀장");
  });

  it("name 없으면 이름 줄 생략", () => {
    const sig = buildHtmlSignature({ ...FULL, name: null });
    expect(sig).not.toContain(">송영신<");
    expect(sig).not.toContain("송영신");
  });

  it("동적 값은 htmlEscape 적용 (주입 방지)", () => {
    const sig = buildHtmlSignature({ ...FULL, name: "<script>x</script>" });
    expect(sig).not.toContain("<script>");
    expect(sig).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("빈 객체여도 고정 정보(회사/주소/F번호/링크)는 렌더", () => {
    const sig = buildHtmlSignature({});
    expect(sig).toContain("(주)진학어플라이");
    expect(sig).toContain("서울특별시 종로구 경희궁길 34 (진학기획B/D 3F)");
    expect(sig).toContain("F. 02-730-0517");
    expect(sig).toContain(
      '<a href="https://www.jinhakapply.com/">원서접수</a>',
    );
  });
});

describe("buildReplyHtml", () => {
  it("본문 htmlify + 서명 조립 (div 래핑)", () => {
    const html = buildReplyHtml("안녕하세요\n감사합니다", FULL);
    expect(html.startsWith("<div>")).toBe(true);
    expect(html.endsWith("</div>")).toBe(true);
    expect(html).toContain("안녕하세요<br>감사합니다");
    expect(html).toContain("<br><br>");
    expect(html).toContain("(주)진학어플라이");
    expect(html).toContain(
      '<a href="https://www.jinhakapply.com/">원서접수</a>',
    );
  });
});
