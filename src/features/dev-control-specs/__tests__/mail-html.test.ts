import { describe, it, expect } from "vitest";
import { buildSpecMailHtml, buildSpecSubject } from "../mail-html";
import type { DevControlSpecItem } from "../schemas";

const items: DevControlSpecItem[] = [
  { key: "period:apply", title: "접수 기간", body: "9월 7일 09시부터", included: true },
  { key: "pay:close", title: "결제 마감", body: "마감 2시간 전", included: false },
  { key: "input:birth", title: "생년월일", body: "잘못 적으면 넘어가지 않습니다", included: true },
];

const args = {
  universityName: "○○대학교",
  serviceName: "2027학년도 수시모집",
  items,
  sourceAnalyzedAt: "2026-09-01T02:00:00Z",
};

describe("buildSpecMailHtml", () => {
  const html = buildSpecMailHtml(args);

  it("포함한 항목만 나간다", () => {
    expect(html).toContain("접수 기간");
    expect(html).toContain("생년월일");
  });

  it("제외한 항목은 제목도 본문도 없다 — 새어 나가면 되돌릴 수 없다", () => {
    expect(html).not.toContain("결제 마감");
    expect(html).not.toContain("마감 2시간 전");
  });

  it("코드를 걷어 온 시각을 적는다 — 학교에는 이게 곧 신뢰다", () => {
    expect(html).toMatch(/2026[.\-년\s]*0?9[.\-월\s]*0?1/);
  });

  it("대학·서비스명이 들어간다", () => {
    expect(html).toContain("○○대학교");
    expect(html).toContain("2027학년도 수시모집");
  });

  it("HTML 특수문자를 이스케이프한다 — 항목 문구는 모델이 쓴 것이다", () => {
    const h = buildSpecMailHtml({
      ...args,
      items: [{ key: "a", title: "<b>제목</b>", body: "a & b", included: true }],
    });
    expect(h).toContain("&lt;b&gt;");
    expect(h).toContain("a &amp; b");
  });

  it("포함 항목이 없으면 빈 문서를 만들지 않는다", () => {
    expect(() =>
      buildSpecMailHtml({ ...args, items: [{ ...items[1] }] }),
    ).toThrow(/항목/);
  });
});

describe("buildSpecSubject", () => {
  it("브랜드가 붙는다 — 사내 메일 표준", () => {
    expect(buildSpecSubject(args)).toContain("[운영부 상황실]");
  });

  it("대학과 서비스를 알아볼 수 있다", () => {
    const s = buildSpecSubject(args);
    expect(s).toContain("○○대학교");
    expect(s).toContain("2027학년도 수시모집");
  });
});
