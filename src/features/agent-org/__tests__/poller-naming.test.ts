import { describe, it, expect } from "vitest";
import { resolveTeam } from "../resolve";
import { AGENT_TEAMS } from "../registry";
import { AUTOMATION_JOBS } from "@/features/automations/registry";

const labels = new Map(AUTOMATION_JOBS.map((j) => [j.id, j.label]));
const cadences = new Map(AUTOMATION_JOBS.map((j) => [j.id, j.cadence as string]));

const all = AGENT_TEAMS.flatMap(
  (t) => resolveTeam(t, labels, cadences).members,
);

/**
 * 잡과 폴러가 **같은 파이프라인의 두 각도**라 이름이 겹쳤다. 마감이 대표적으로
 * `서비스 마감 스크래핑`(잡) 과 `마감 스크래핑`(폴러) 이라 화면에서 둘이
 * 무엇이 다른지 알 수 없었다.
 *
 * 고장 지점이 다르므로 둘 다 있어야 한다 — PC 가 죽으면 폴러가 멈추고,
 * 스크래핑이 깨지면 잡에 실패가 남는다. 그러니 **이름으로 갈라야 한다.**
 */
describe("에이전트 명칭", () => {
  it("폴러는 이름에 폴러라고 적는다 — 잡과 같은 이름이면 못 가른다", () => {
    const pollers = all.filter((m) => "pollerId" in m && m.pollerId);
    expect(pollers.length).toBeGreaterThan(0);
    for (const p of pollers) {
      expect(p.detail, p.agent).toMatch(/폴러$/);
    }
  });

  it("이름이 겹치는 에이전트가 없다", () => {
    const names = all.map((m) => m.detail || m.role);
    expect(new Set(names).size).toBe(names.length);
  });

  /** 잡 이름을 조직도에 복사하면 두 벌이 되어 언젠가 갈라진다. */
  it("잡 이름은 원본 그대로다 — 손대지 않는다", () => {
    const closing = all.find((m) => m.agent === "closing-scraper");
    expect(closing?.detail).toBe(labels.get("closing-scrape"));
  });
});
