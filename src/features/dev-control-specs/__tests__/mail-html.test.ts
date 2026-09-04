import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * 본문은 **안내 몇 줄**이다 — 내용은 첨부 문서에 있다.
 *
 * 항목을 본문에 다 실었더니 실측 68항목이 23,734자였다(2026-09-04). 메일에서
 * 스크롤로 읽을 분량이 아니라 문서로 옮겼다.
 */
describe("buildSpecMailHtml", () => {
  const html = buildSpecMailHtml(args);

  it("짧다 — 본문에 항목을 늘어놓지 않는다", () => {
    expect(html.length).toBeLessThan(1200);
  });

  it("항목 내용이 본문에 없다", () => {
    expect(html).not.toContain("9월 7일부터");
    expect(html).not.toContain("잘못 적으면");
  });

  it("첨부를 보라고 알려준다 — 안 그러면 빈 메일로 보인다", () => {
    expect(html).toMatch(/첨부/);
  });

  it("몇 건인지 알려준다", () => {
    expect(html).toContain("2건");
  });

  it("대학·서비스명이 들어간다", () => {
    expect(html).toContain("○○대학교");
    expect(html).toContain("2027학년도 수시모집");
  });

  it("포함 항목이 없으면 보낼 수 없다", () => {
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

/**
 * 발송 action 이 서비스 정보를 **어느 테이블에서** 읽는가.
 *
 * 개발 탭 목록은 `closing_services` 에서 온다(`listTestableServices`). action 이
 * `services` 를 보면 대학명을 못 찾아 **"서비스 정보를 찾을 수 없습니다"** 로
 * 발송이 막힌다 — 목록에는 멀쩡히 떠 있는데 보낼 수만 없다(2026-09-04 실제로 겪음).
 */
describe("발송 action 의 서비스 조회", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/dev-control-specs/actions.ts"),
    "utf8",
  );

  it("closing_services 를 본다 — 목록과 같은 출처여야 한다", () => {
    expect(src).toContain('from("closing_services")');
  });

  it("services 를 보지 않는다", () => {
    expect(src).not.toContain('from("services")');
  });
});

/**
 * 내용은 **첨부 문서**로 나간다 — 본문에 다 실으면 23,734자가 된다.
 */
describe("발송 action 의 첨부", () => {
  const src = readFileSync(
    join(process.cwd(), "src/features/dev-control-specs/actions.ts"),
    "utf8",
  );

  it("HTML 문서를 만들어 첨부한다", () => {
    expect(src).toContain("buildSpecHtmlDocument");
    expect(src).toContain("attachments");
  });

  it("text/html 로 붙인다 — 메일 클라이언트가 바로 연다", () => {
    expect(src).toContain("text/html");
  });

  it("파일명 규칙을 따로 적지 않는다 — specAttachmentName 하나뿐이다", () => {
    expect(src).toContain("specAttachmentName");
    expect(src).not.toContain("원서제어 안내서.html");
  });

  it("보낸 문서를 이력에 남긴다 — 나중에 항목이 바뀌어도 그때 것이 남아야 한다", () => {
    expect(src).toContain("body_html");
  });
});
