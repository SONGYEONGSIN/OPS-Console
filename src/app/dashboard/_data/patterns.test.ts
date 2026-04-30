import { describe, it, expect } from "vitest";
import type { ProjectMockData } from "./patterns";

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
