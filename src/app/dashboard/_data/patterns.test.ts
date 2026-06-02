import { describe, it, expect } from "vitest";
import { getPatternMockData, type ProjectMockData } from "./patterns";
import { findSidebarMeta } from "../_data";

const ALL_SLUGS = [
  "my-todo", "schedule",
  "handover", "data-requests", "incidents", "contacts", "backup", "vault",
  "services", "contracts", "dev-test", "deploy", "closing", "settlement", "invoice", "receivables",
  "pims", "reception-admin", "internal-admin", "competition", "generator",
  "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  "worklog", "outcomes", "reports",
  "ai-insight", "ai-assistant", "my-ai-work", "ai-tips",
  "manuals", "operating-guide", "meetings", "faq",
  "team", "settings", "onboarding", "feedback", "notices",
];

const PROJECT_SLUGS = [
  "pims", "reception-admin", "internal-admin", "competition", "generator",
  "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
];

describe("ProjectMockData type", () => {
  it("필수 필드 4개 (meta / attributes / improvements / activities)를 가진다", () => {
    const sample: ProjectMockData = {
      meta: {
        manager: "박지연",
        status: "진행",
        quarterTarget: "2026 Q2 · 62%",
        serviceCount: "14건 (배포 12 / 마감 2)",
      },
      attributes: [{ k: "담당자", v: "박지연 · 운영1팀" }],
      improvements: [
        { title: "접수 폼 검증", pm: "박지연", due: "2026-05-15", status: "run" },
      ],
      activities: [{ time: "2026-04-29", who: "박지연", act: "검증 작업 시작" }],
    };

    expect(sample.meta.manager).toBe("박지연");
    expect(sample.attributes).toHaveLength(1);
    expect(sample.improvements[0].status).toBe("run");
    expect(sample.activities[0].time).toBe("2026-04-29");
  });

  it("improvements.status 리터럴 3종 (run / rev / wait) 허용", () => {
    const statuses: ProjectMockData["improvements"][number]["status"][] = [
      "run",
      "rev",
      "wait",
    ];
    expect(statuses).toEqual(["run", "rev", "wait"]);
  });
});

describe("getPatternMockData 47 slug 매칭", () => {
  it.each(ALL_SLUGS)("%s slug에 대해 mock 데이터 반환 (null 아님)", (slug) => {
    const meta = findSidebarMeta(slug);
    expect(meta).not.toBeNull();
    if (!meta) return;
    const data = getPatternMockData(slug, meta.pattern);
    expect(data).not.toBeNull();
    expect(data).toBeDefined();
  });

  it.each(PROJECT_SLUGS)("%s 프로젝트 mock에 4 필드 모두 존재", (slug) => {
    const data = getPatternMockData(slug, "project") as ProjectMockData;
    expect(data.meta).toBeDefined();
    expect(data.meta.manager).toBeTruthy();
    expect(Array.isArray(data.attributes)).toBe(true);
    expect(Array.isArray(data.improvements)).toBe(true);
    expect(Array.isArray(data.activities)).toBe(true);
  });
});

