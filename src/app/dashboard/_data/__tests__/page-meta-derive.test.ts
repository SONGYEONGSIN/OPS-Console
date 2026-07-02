import { describe, it, expect } from "vitest";
import { derivePageMeta } from "../page-meta-derive";
import type { SbItem } from "../../_data";

/**
 * derivePageMeta는 KST 시간 기반 시프트(주간 I/II/야간 III) + 오늘 날짜 + 패턴별
 * 항목을 반환. 시간 의존이라 핵심 항목 존재 여부 + tone만 검증.
 */
describe("derivePageMeta", () => {
  const labelOf = (m: { label: string }[] | undefined) =>
    (m ?? []).map((x) => x.label);

  it("list 패턴 + count → count건 + 자동 새로고침 항목 포함", () => {
    const sidebarMeta: SbItem = {
      ico: "·",
      label: "대학 연락처",
      count: "87",
      slug: "contacts",
      pattern: "list",
    };
    const result = derivePageMeta("contacts", sidebarMeta);
    expect(result.headline.title).toBe("대학 연락처");
    expect(result.headline.accent).toBe("고객응대");
    expect(labelOf(result.meta)).toContain("87건");
    // '자동 새로고침 30초'는 ListPattern 헤더에서 카운트다운으로 직접 표시 (PageMeta에서 제외)
    expect(result.meta?.[0].tone).toBe("accent"); // 첫 항목(시프트)이 accent
    expect(result.description).toContain("대학 연락처 목록");
  });

  it("dash 패턴 + count → 위젯 N개 + 실시간 스트림", () => {
    const sidebarMeta: SbItem = {
      ico: "✦",
      label: "새 알림",
      count: "3",
      slug: "alerts",
      pattern: "dash",
    };
    const result = derivePageMeta("alerts", sidebarMeta);
    expect(labelOf(result.meta)).toContain("위젯 3개");
    expect(labelOf(result.meta)).toContain("실시간 스트림");
  });

  it("project 패턴 — 운영 진행 항목", () => {
    const sidebarMeta: SbItem = {
      ico: "◇",
      label: "결제 시스템",
      slug: "payment",
      pattern: "project",
    };
    const result = derivePageMeta("payment", sidebarMeta);
    expect(labelOf(result.meta)).toContain("운영 진행");
  });

  it("log 패턴 — 로그 스트림 항목", () => {
    const sidebarMeta: SbItem = {
      ico: "≡",
      label: "Kibana 로그",
      slug: "kibana",
      pattern: "log",
    };
    const result = derivePageMeta("kibana", sidebarMeta);
    expect(labelOf(result.meta)).toContain("로그 스트림");
  });

  it("settings 패턴 — sidebar label을 meta에 표시", () => {
    const sidebarMeta: SbItem = {
      ico: "⚙",
      label: "시스템 설정",
      slug: "settings",
      pattern: "settings",
    };
    const result = derivePageMeta("settings", sidebarMeta);
    expect(labelOf(result.meta)).toContain("시스템 설정");
    expect(labelOf(result.meta)).not.toContain("관리자 설정");
  });

  it("section 직속 item — accent = section title", () => {
    const sidebarMeta: SbItem = {
      ico: "◈",
      label: "인수인계",
      count: "2",
      slug: "handover",
      pattern: "list",
    };
    const result = derivePageMeta("handover", sidebarMeta);
    expect(result.headline.accent).toBe("요청 · 자료");
  });

  it("count 없음 — 시프트/날짜 2항목", () => {
    const sidebarMeta: SbItem = {
      ico: "▣",
      label: "자료 보관",
      slug: "vault",
      pattern: "list",
    };
    const result = derivePageMeta("vault", sidebarMeta);
    // count 없음 → 2개 (shift + date). 자동 새로고침 카운트다운은 ListPattern 헤더로 이동.
    expect(result.meta).toHaveLength(2);
  });
});
