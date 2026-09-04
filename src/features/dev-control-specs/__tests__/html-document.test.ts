import { describe, it, expect } from "vitest";
import { buildSpecHtmlDocument, specAttachmentName } from "../html-document";
import type { DevControlSpecItem } from "../schemas";

const items: DevControlSpecItem[] = [
  { key: "period", title: "접수 기간", body: "9월 7일부터", included: true },
  { key: "pay", title: "결제 마감", body: "마감 2시간 전", included: false },
  { key: "input", title: "생년월일", body: "잘못 적으면 넘어가지 않습니다", included: true },
];

const args = {
  universityName: "조선대학교",
  serviceName: "2027학년도 수시모집",
  items,
  sourceAnalyzedAt: "2026-09-01T02:00:00Z",
};

describe("buildSpecHtmlDocument", () => {
  const html = buildSpecHtmlDocument(args);

  it("메일 클라이언트가 바로 여는 온전한 문서다", () => {
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('charset="utf-8"');
  });

  it("포함한 항목만 담는다", () => {
    expect(html).toContain("접수 기간");
    expect(html).toContain("생년월일");
  });

  it("제외한 항목은 없다 — 문서로 나가면 되돌릴 수 없다", () => {
    expect(html).not.toContain("결제 마감");
    expect(html).not.toContain("마감 2시간 전");
  });

  it("번호를 새로 매긴다 — 뺀 자리가 빈 번호로 남으면 안 된다", () => {
    // 1, 2 두 개만 있어야 한다(원래 3번이던 항목이 2번이 된다).
    expect(html).toContain(">1<");
    expect(html).toContain(">2<");
    expect(html).not.toContain(">3<");
  });

  it("대학·서비스·수집 시각이 머리에 있다", () => {
    expect(html).toContain("조선대학교");
    expect(html).toContain("2027학년도 수시모집");
    expect(html).toMatch(/2026[.\-년\s]*0?9[.\-월\s]*0?1/);
  });

  it("브랜드가 붙는다", () => {
    expect(html).toContain("운영부 상황실");
  });

  it("모델이 쓴 문구를 이스케이프한다", () => {
    const h = buildSpecHtmlDocument({
      ...args,
      items: [{ key: "a", title: "<b>제목</b>", body: "a & b", included: true }],
    });
    expect(h).toContain("&lt;b&gt;");
    expect(h).toContain("a &amp; b");
  });

  it("인쇄해도 깨지지 않는다 — 학교가 내부 회람할 수 있다", () => {
    expect(html).toContain("@media print");
  });

  it("포함 항목이 없으면 빈 문서를 만들지 않는다", () => {
    expect(() =>
      buildSpecHtmlDocument({ ...args, items: [items[1]] }),
    ).toThrow(/항목/);
  });
});

describe("specAttachmentName", () => {
  it("서비스명 + 원서제어 안내서", () => {
    expect(specAttachmentName(args)).toBe("2027학년도 수시모집 원서제어 안내서.html");
  });

  it("서비스명이 없으면 대학명을 쓴다 — 이름 없는 첨부는 못 알아본다", () => {
    expect(specAttachmentName({ ...args, serviceName: null })).toBe(
      "조선대학교 원서제어 안내서.html",
    );
  });

  it("파일명에 못 쓰는 문자를 뺀다 — 서비스명에 슬래시가 온다", () => {
    const name = specAttachmentName({ ...args, serviceName: "수시/정시 1차" });
    expect(name).not.toMatch(/[\/:*?"<>|]/);
  });
});
