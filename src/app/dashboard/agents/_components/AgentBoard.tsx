import Link from "next/link";
import { AgentCard, type AgentCardMember } from "./AgentCard";
import type { AgentUsage } from "@/features/agent-org/usage";

/**
 * 에이전트 관제탑.
 *
 * 팀 카드 5장으로 묶어 보여주던 것을 걷었다 — 요청이 "팀별 자동화 묶음이 아니라
 * 시스템을 운영하는 독립적인 주체로 보고 싶다"였다. 이제 화면의 기본 단위는
 * 에이전트 하나이고, **팀은 거르는 수단으로만** 남는다.
 *
 * 맨 위 한 줄이 '지금 시스템이 잘 돌고 있나'에 답한다. 그 아래는 개체다.
 */

export function AgentBoard({
  members,
  verdicts,
  usage,
  team,
}: {
  members: AgentCardMember[];
  /** 폴러 id → 판정. `system-status` 가 내린 것을 받아 적기만 한다. */
  verdicts: Record<string, string>;
  usage: Record<string, AgentUsage>;
  /** 고른 팀. 없으면 전체. */
  team?: string;
}) {
  const teams = [...new Set(members.map((m) => m.team))];
  const shown = team ? members.filter((m) => m.team === team) : members;

  const withPoller = members.filter((m) => m.pollerId);
  const stopped = withPoller.filter(
    (m) => verdicts[m.pollerId!] === "stopped",
  ).length;
  const working = withPoller.filter(
    (m) => verdicts[m.pollerId!] === "working",
  ).length;
  // 셀 수 없는 자리는 0 으로 더하지 않는다 — 안 돈 것과 다르다.
  const todayTotal = members.reduce(
    (n, m) => n + (usage[m.agent]?.today ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-6 border-b-2 border-ink pb-3">
        <Kpi label="도는 중" value={working} />
        <Kpi label="멈춤" value={stopped} testId="kpi-stopped" alert={stopped > 0} />
        <Kpi label="오늘 실행" value={todayTotal} />
        <Kpi label="에이전트" value={members.length} />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Chip href="/dashboard/agents" active={!team}>
          전체
        </Chip>
        {teams.map((t) => (
          <Chip
            key={t}
            href={`/dashboard/agents?team=${encodeURIComponent(t)}`}
            active={team === t}
          >
            {t} {members.filter((m) => m.team === t).length}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((m) => (
          <AgentCard
            key={m.agent}
            member={m}
            verdict={m.pollerId ? verdicts[m.pollerId] : undefined}
            usage={usage[m.agent] ?? { daily: null, today: null }}
          />
        ))}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  alert,
  testId,
}: {
  label: string;
  value: number;
  alert?: boolean;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="flex items-baseline gap-1.5">
      <span className="text-2xs uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <span
        className={`text-lg font-bold tabular-nums ${
          alert ? "text-vermilion" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-vermilion bg-vermilion/10 text-vermilion"
          : "border-line-soft text-ink-soft hover:bg-line-soft"
      }`}
    >
      {children}
    </Link>
  );
}
