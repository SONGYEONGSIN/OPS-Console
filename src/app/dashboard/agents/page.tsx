import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { AUTOMATION_JOBS } from "@/features/automations/registry";
import { AGENT_TEAMS } from "@/features/agent-org/registry";
import { buildJobLabels, resolveTeam } from "@/features/agent-org/resolve";
import { loadPollerStatuses } from "@/features/system-status/queries";
import { TeamCard } from "./_components/TeamCard";

export default async function AgentsPage() {
  const slug = "agents";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const labels = buildJobLabels(AUTOMATION_JOBS);
  const teams = AGENT_TEAMS.map((t) => resolveTeam(t, labels));

  // 회사 PC 에서 도는 에이전트의 생사. 판정은 system-status 가 하고 여기는
  // 받아 적기만 한다 — 두 벌로 판정하면 설정 화면과 답이 갈린다.
  const statuses = await loadPollerStatuses();
  const pollerVerdicts = Object.fromEntries(
    statuses.map((s) => [s.id, s.verdict]),
  );
  const memberCount = teams.reduce((n, t) => n + t.members.length, 0);
  const config = resolvePageMeta(slug, meta, memberCount);

  return (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <div className="p-5 lg:p-7">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} pollerVerdicts={pollerVerdicts} />
          ))}
        </div>
      </div>
    </>
  );
}
