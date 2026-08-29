import { POLLERS } from "@/features/system-status/pollers";
import type { AgentTeam } from "./types";

export type ResolvedMember = {
  role: string;
  agent: string;
  llm: boolean;
  /** 화면에 적을 한 줄. planned면 빈 문자열 */
  detail: string;
  planned: boolean;
  /** 회사 PC 폴러면 그 id — 화면이 이걸로 생사 배지를 붙인다. */
  pollerId?: string;
};

export type ResolvedTeam = {
  id: string;
  name: string;
  leaderName: string;
  tagline: string;
  traits: string[];
  members: ResolvedMember[];
};

/** jobId → label. 잡 라벨을 조직 레지스트리에 복사하지 않기 위한 조회표. */
export function buildJobLabels(
  jobs: readonly { id: string; label: string }[],
): ReadonlyMap<string, string> {
  return new Map(jobs.map((j) => [j.id, j.label]));
}

export function resolveTeam(
  team: AgentTeam,
  labels: ReadonlyMap<string, string>,
): ResolvedTeam {
  return {
    id: team.id,
    name: team.name,
    leaderName: team.leader.name,
    tagline: team.leader.tagline,
    traits: team.traits,
    members: team.members.map((m) => {
      const base = { role: m.role, agent: m.agent, llm: m.llm ?? false };
      if (m.source.kind === "planned") {
        return { ...base, detail: "", planned: true };
      }
      if (m.source.kind === "outside") {
        return { ...base, detail: m.source.note, planned: false };
      }
      if (m.source.kind === "poller") {
        // 콜백 안에서는 좁혀진 타입이 풀린다 — 먼저 꺼내 둔다.
        const { pollerId } = m.source;
        // 폴러 라벨도 원본에서 가져온다 — 조직도에 복사하면 두 벌이 되어 갈라진다.
        const poller = POLLERS.find((p) => p.id === pollerId);
        if (!poller) {
          throw new Error(
            `조직도가 없는 폴러를 가리킨다: ${m.agent} → ${pollerId}`,
          );
        }
        return { ...base, detail: poller.label, planned: false, pollerId };
      }
      const label = labels.get(m.source.jobId);
      if (label === undefined) {
        // registry.test.ts가 막는 상태다. 조용히 jobId로 대체하면 화면이 그럴듯하게
        // 틀린 채 남으므로 크게 실패시킨다.
        throw new Error(
          `조직도가 없는 잡을 가리킨다: ${m.agent} → ${m.source.jobId}`,
        );
      }
      return { ...base, detail: label, planned: false };
    }),
  };
}
