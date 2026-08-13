import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AGENT_TEAMS } from "../registry";
import { AUTOMATION_JOBS } from "@/features/automations/registry";

/**
 * 조직도가 현실과 갈라지는 것을 막는다.
 *
 * 2026-08-13 하루에 같은 구조의 사고를 세 번 겪었다(날짜 입력·버튼 표준·팀 값).
 * 전부 "타입 검사도 CI도 통과하는데 화면만 틀린" 종류였다. 조직도는 사람이 손으로
 * 유지하는 목록이라 같은 실패에 가장 취약하다.
 *
 * 보증 범위: 레지스트리 잡 17개만 완전성을 본다. kind:"outside" 셋은 손으로 적은
 * 것이라, 레지스트리 밖에 네 번째가 새로 생기면 이 테스트가 못 잡는다
 * (CRON_SECRET 엔드포인트 15개의 역할이 셋으로 섞여 있어 자동 판정 시 오탐).
 */
const allMembers = AGENT_TEAMS.flatMap((t) =>
  t.members.map((m) => ({ team: t.name, ...m })),
);

describe("에이전트 조직 레지스트리", () => {
  it("모든 jobId가 자동화 레지스트리에 실재한다", () => {
    const known = new Set(AUTOMATION_JOBS.map((j) => j.id));
    for (const m of allMembers) {
      if (m.source.kind !== "job") continue;
      expect(known, `${m.team} ${m.agent}의 jobId`).toContain(m.source.jobId);
    }
  });

  it("레지스트리 잡이 각각 정확히 한 팀에 속한다", () => {
    const placed = allMembers
      .filter((m) => m.source.kind === "job")
      .map((m) => (m.source.kind === "job" ? m.source.jobId : ""));
    const missing = AUTOMATION_JOBS.map((j) => j.id).filter(
      (id) => !placed.includes(id),
    );
    const duplicated = placed.filter((id, i) => placed.indexOf(id) !== i);
    expect(missing, "조직도에 배치되지 않은 잡").toEqual([]);
    expect(duplicated, "두 팀에 중복 배치된 잡").toEqual([]);
  });

  it("outside 경로의 파일이 실재한다", () => {
    for (const m of allMembers) {
      if (m.source.kind !== "outside") continue;
      const rel = m.source.path.startsWith("/api/")
        ? join("src", "app", m.source.path.slice(1), "route.ts")
        : join("src", m.source.path);
      expect(existsSync(join(process.cwd(), rel)), `${m.agent} → ${rel}`).toBe(
        true,
      );
    }
  });

  it("에이전트 이름이 전 팀에서 유일하다", () => {
    const names = allMembers.map((m) => m.agent);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup, "중복된 에이전트 이름").toEqual([]);
  });

  it("에이전트 이름이 kebab-case다", () => {
    for (const m of allMembers) {
      expect(m.agent, `${m.team} ${m.role}`).toMatch(
        /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
      );
    }
  });
});
