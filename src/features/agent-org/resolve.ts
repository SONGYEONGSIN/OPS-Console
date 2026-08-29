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
  /**
   * 무엇이 이 에이전트를 부르는가 — 요청 대기 / 주기 실행 / 수동 실행 / 상시.
   *
   * '처리 중' 배지가 회사 PC 폴러에만 붙어서 **나머지가 죽은 것처럼 보였다.**
   * 생사라는 개념이 없는 것뿐이다 — cron 이 부르면 돌고 끝난다. 그 차이를
   * 화면이 말해줘야 배지 없음을 이상으로 읽지 않는다.
   */
  driver: string;
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

/** cron 주기 → 사람이 읽는 구동 방식. `manual` 만 갈라 적는다. */
function driverOfCadence(cadence: string | undefined): string {
  return cadence === "manual" ? "수동 실행" : "주기 실행";
}

export function resolveTeam(
  team: AgentTeam,
  labels: ReadonlyMap<string, string>,
  /** jobId → cadence. 없으면 주기를 모르는 것으로 보고 '주기 실행'만 적는다. */
  cadences: ReadonlyMap<string, string> = new Map(),
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
        return { ...base, detail: "", planned: true, driver: "" };
      }
      if (m.source.kind === "outside") {
        return { ...base, detail: m.source.note, planned: false, driver: "상시" };
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
        // 폴러는 큐를 보고 있다가 요청이 들어오면 돈다.
        return {
          ...base,
          detail: poller.label,
          planned: false,
          pollerId,
          driver: "요청 대기",
        };
      }
      const label = labels.get(m.source.jobId);
      if (label === undefined) {
        // registry.test.ts가 막는 상태다. 조용히 jobId로 대체하면 화면이 그럴듯하게
        // 틀린 채 남으므로 크게 실패시킨다.
        throw new Error(
          `조직도가 없는 잡을 가리킨다: ${m.agent} → ${m.source.jobId}`,
        );
      }
      return {
        ...base,
        detail: label,
        planned: false,
        driver: driverOfCadence(cadences.get(m.source.jobId)),
      };
    }),
  };
}
