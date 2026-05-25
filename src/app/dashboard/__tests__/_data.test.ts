import { describe, it, expect } from "vitest";
import { sidebarSections, findSidebarMeta } from "../_data";

const ALL_SLUGS = [
  // 개요
  "my-todo", "schedule",
  // 요청 · 자료
  "handover", "data-requests", "incidents", "contacts", "backup", "vault",
  // 서비스사이클
  "services", "contracts", "dev-test", "deploy", "closing", "settlement", "invoice", "receivables",
  // 프로젝트 (project 패턴)
  "pims", "reception-admin", "internal-admin", "competition", "generator",
  "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  // 분석 · AI
  "worklog", "outcomes", "reports",
  "ai-insight", "ai-assistant", "my-ai-work", "ai-tips",
  // 매뉴얼 · 가이드
  "manuals", "sop", "operating-guide", "meetings", "statements", "faq",
  // 관리
  "team", "settings", "onboarding", "feedback", "notices",
];

describe("sidebarSections 신규 IA", () => {
  it("6 섹션", () => {
    expect(sidebarSections.length).toBe(6);
  });

  it("섹션 라벨 순서 정확", () => {
    expect(sidebarSections.map((s) => s.title)).toEqual([
      "개요",
      "요청 · 자료",
      "서비스 그룹",
      "분석 · AI",
      "매뉴얼 · 가이드",
      "관리",
    ]);
  });
});

describe("findSidebarMeta 46 slug 검증", () => {
  it.each(ALL_SLUGS)("%s slug에 대한 메타 lookup 성공", (slug) => {
    const meta = findSidebarMeta(slug);
    expect(meta).not.toBeNull();
    expect(meta?.label).toBeTruthy();
    expect(meta?.pattern).toMatch(/^(list|dash|log|settings|project)$/);
  });

  it("잘못된 slug → null", () => {
    expect(findSidebarMeta("nonexistent-zzz")).toBeNull();
  });
});

describe("프로젝트 12 항목 패턴 검증", () => {
  const PROJECT_SLUGS = [
    "pims", "reception-admin", "internal-admin", "competition", "generator",
    "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  ];
  it.each(PROJECT_SLUGS)("%s는 project 패턴", (slug) => {
    expect(findSidebarMeta(slug)?.pattern).toBe("project");
  });
});
