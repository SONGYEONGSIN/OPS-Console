import { describe, it, expect } from "vitest";
import { derivePageMeta } from "../page-meta-derive";
import type { SbItem } from "../../_data";

describe("derivePageMeta", () => {
  it("list 패턴 + count → 전체 N건 메타 + 목록 description", () => {
    const sidebarMeta: SbItem = {
      ico: "·",
      label: "대학 연락처",
      count: "87",
      slug: "contacts",
      pattern: "list",
    };
    const result = derivePageMeta("contacts", sidebarMeta);
    expect(result.headline.title).toBe("대학 연락처");
    expect(result.headline.accent).toBe("고객 응대");
    expect(result.meta).toEqual([{ label: "전체", value: "87건" }]);
    expect(result.description).toContain("대학 연락처 목록");
    expect(result.description).toContain("인스펙터");
  });

  it("dash 패턴 — 위젯 N개 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "✦",
      label: "새 알림",
      count: "3",
      slug: "alerts",
      pattern: "dash",
    };
    const result = derivePageMeta("alerts", sidebarMeta);
    expect(result.meta).toEqual([{ label: "위젯", value: "3개" }]);
    expect(result.description).toContain("위젯");
  });

  it("project 패턴 — 운영 accent meta", () => {
    const sidebarMeta: SbItem = {
      ico: "◇",
      label: "결제 시스템",
      slug: "payment",
      pattern: "project",
    };
    const result = derivePageMeta("payment", sidebarMeta);
    expect(result.meta).toEqual([{ label: "운영", tone: "accent" }]);
    expect(result.description).toContain("프로젝트");
  });

  it("log 패턴 — stream 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "≡",
      label: "Kibana 로그",
      slug: "kibana",
      pattern: "log",
    };
    const result = derivePageMeta("kibana", sidebarMeta);
    expect(result.meta).toEqual([{ label: "로그", value: "stream" }]);
    expect(result.description).toContain("로그 스트림");
  });

  it("settings 패턴 — 빈 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "📊",
      label: "Grafana 지표",
      slug: "grafana",
      pattern: "settings",
    };
    const result = derivePageMeta("grafana", sidebarMeta);
    expect(result.meta).toEqual([]);
    expect(result.description).toContain("설정");
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

  it("count 없음 — 빈 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "▣",
      label: "자료 보관",
      slug: "vault",
      pattern: "list",
    };
    const result = derivePageMeta("vault", sidebarMeta);
    expect(result.meta).toEqual([]);
  });
});
