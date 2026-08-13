import { describe, it, expect } from "vitest";
import { buildJobLabels, resolveTeam } from "../resolve";
import type { AgentTeam } from "../types";

const labels = buildJobLabels([
  { id: "closing-scrape", label: "서비스 마감 스크래핑" },
]);

const team: AgentTeam = {
  id: "collect",
  name: "수집팀",
  leader: { name: "지성", tagline: "온 그라운드를 돈다" },
  traits: ["완주"],
  members: [
    {
      role: "마감",
      agent: "closing-scraper",
      source: { kind: "job", jobId: "closing-scrape" },
    },
    {
      role: "실패",
      agent: "failure-watcher",
      source: {
        kind: "outside",
        path: "features/automations/failure-notify.ts",
        note: "실패 즉시 알림",
      },
    },
    { role: "추적", agent: "trace-recorder", source: { kind: "planned" } },
  ],
};

describe("resolveTeam", () => {
  it("잡 팀원은 레지스트리 라벨을 detail로 쓴다", () => {
    const r = resolveTeam(team, labels);
    expect(r.members[0].detail).toBe("서비스 마감 스크래핑");
    expect(r.members[0].planned).toBe(false);
  });

  it("outside 팀원은 직접 쓴 설명을 detail로 쓴다", () => {
    const r = resolveTeam(team, labels);
    expect(r.members[1].detail).toBe("실패 즉시 알림");
    expect(r.members[1].planned).toBe(false);
  });

  it("planned 팀원만 planned=true다", () => {
    const r = resolveTeam(team, labels);
    expect(r.members[2].planned).toBe(true);
    expect(r.members[2].detail).toBe("");
  });

  it("팀장·성향을 그대로 옮긴다", () => {
    const r = resolveTeam(team, labels);
    expect(r.leaderName).toBe("지성");
    expect(r.tagline).toBe("온 그라운드를 돈다");
    expect(r.traits).toEqual(["완주"]);
  });

  it("없는 jobId는 조용히 넘기지 않고 던진다", () => {
    const broken: AgentTeam = {
      ...team,
      members: [
        {
          role: "x",
          agent: "ghost",
          source: { kind: "job", jobId: "no-such-job" },
        },
      ],
    };
    expect(() => resolveTeam(broken, labels)).toThrow(/no-such-job/);
  });
});
