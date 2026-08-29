import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { AUTOMATION_JOBS } from "@/features/automations/registry";
import { AGENT_TEAMS } from "@/features/agent-org/registry";
import { buildJobLabels, resolveTeam } from "@/features/agent-org/resolve";
import { loadAgentUsage } from "@/features/agent-org/usage";
import { loadPollerStatuses } from "@/features/system-status/queries";
import { AgentBoard } from "./_components/AgentBoard";
import type { AgentCardMember } from "./_components/AgentCard";

/**
 * 에이전트 관제탑.
 *
 * 팀 카드 5장으로 묶어 보여주던 정적 조직도를 걷었다 — 요청이 "팀별 자동화 묶음이
 * 아니라 시스템을 운영하는 독립적인 주체로 보고 싶다"였다. 화면의 기본 단위는
 * 에이전트 하나이고 팀은 필터로만 남는다.
 *
 * 숫자는 새 테이블 없이 **이미 남고 있는 것**에서 나온다 — 자동화 잡은
 * `automation_runs`, 회사 PC 폴러는 각자의 큐. 생사는 `system-status` 가 내린
 * 판정을 그대로 받아 적는다(두 벌로 판정하면 설정 화면과 답이 갈린다).
 */
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const slug = "agents";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const { team } = await searchParams;

  const labels = buildJobLabels(AUTOMATION_JOBS);
  const members: AgentCardMember[] = AGENT_TEAMS.flatMap((t) => {
    const resolved = resolveTeam(t, labels);
    return resolved.members.map((m) => ({
      agent: m.agent,
      role: m.role,
      team: resolved.name,
      detail: m.detail,
      llm: m.llm,
      planned: m.planned,
      pollerId: m.pollerId,
    }));
  });

  const [statuses, usage] = await Promise.all([
    loadPollerStatuses(),
    loadAgentUsage(),
  ]);
  const verdicts = Object.fromEntries(statuses.map((s) => [s.id, s.verdict]));

  const config = resolvePageMeta(slug, meta, members.length);

  return (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <div className="p-5 lg:p-7">
        <AgentBoard
          members={members}
          verdicts={verdicts}
          usage={usage}
          team={team}
        />
      </div>
    </>
  );
}
