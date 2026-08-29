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

/**
 * 폴러 팀원도 화면 문구를 가져야 한다. 잡 라벨을 조직도에 복사하지 않듯,
 * 폴러 라벨도 `POLLERS` 에서 가져온다 — 두 벌이 되면 갈라진다.
 */
describe("resolveTeam — 폴러 팀원", () => {
  it("폴러 라벨을 문구로 쓴다", () => {
    const team = {
      id: "t",
      name: "T",
      leader: { name: "L", tagline: "" },
      traits: [],
      members: [
        {
          role: "어시스턴트",
          agent: "assistant-runner",
          source: { kind: "poller" as const, pollerId: "assistant" },
        },
      ],
    };
    const r = resolveTeam(team, new Map());
    expect(r.members[0].detail).toContain("어시스턴트");
    expect(r.members[0].planned).toBe(false);
  });

  it("없는 폴러를 가리키면 크게 실패한다 — 조용히 틀린 화면을 두지 않는다", () => {
    const team = {
      id: "t",
      name: "T",
      leader: { name: "L", tagline: "" },
      traits: [],
      members: [
        {
          role: "x",
          agent: "x",
          source: { kind: "poller" as const, pollerId: "없는폴러" },
        },
      ],
    };
    expect(() => resolveTeam(team, new Map())).toThrow(/폴러/);
  });
});

/**
 * '처리 중' 배지가 회사 PC 폴러에만 붙어서, 나머지가 죽은 것처럼 보였다.
 * 생사라는 개념이 없는 것뿐인데. 무엇이 어떻게 도는지를 갈라 적는다.
 */
describe("resolveTeam — 구동 방식", () => {
  const team = (member: AgentTeam["members"][number]): AgentTeam => ({
    id: "t",
    name: "T",
    leader: { name: "L", tagline: "" },
    traits: [],
    members: [member],
  });

  it("회사 PC 폴러는 '요청 대기' — 큐를 보고 있다가 요청이 오면 돈다", () => {
    const r = resolveTeam(
      team({
        role: "x",
        agent: "a",
        source: { kind: "poller", pollerId: "assistant" },
      }),
      new Map(),
    );
    expect(r.members[0].driver).toBe("요청 대기");
  });

  it("자동화 잡은 주기를 적는다 — cron 이 부를 때만 돈다", () => {
    const r = resolveTeam(
      team({
        role: "x",
        agent: "a",
        source: { kind: "job", jobId: "knowledge-index" },
      }),
      buildJobLabels([{ id: "knowledge-index", label: "지식망 인덱싱" }]),
      new Map([["knowledge-index", "hourly"]]),
    );
    expect(r.members[0].driver).toBe("주기 실행");
  });

  it("수동 잡은 그렇다고 적는다", () => {
    const r = resolveTeam(
      team({ role: "x", agent: "a", source: { kind: "job", jobId: "j" } }),
      buildJobLabels([{ id: "j", label: "J" }]),
      new Map([["j", "manual"]]),
    );
    expect(r.members[0].driver).toBe("수동 실행");
  });

  it("상시 동작은 '상시'", () => {
    const r = resolveTeam(
      team({
        role: "x",
        agent: "a",
        source: { kind: "outside", path: "p", note: "n" },
      }),
      new Map(),
    );
    expect(r.members[0].driver).toBe("상시");
  });

  it("예정은 구동이 없다", () => {
    const r = resolveTeam(
      team({ role: "x", agent: "a", source: { kind: "planned" } }),
      new Map(),
    );
    expect(r.members[0].driver).toBe("");
  });
});
