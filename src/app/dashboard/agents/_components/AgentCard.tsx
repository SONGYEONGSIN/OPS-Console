import type { AgentUsage } from "@/features/agent-org/usage";

/**
 * 관제탑 카드 한 장 — "이 에이전트가 지금 살아 있나 / 얼마나 도나".
 *
 * 팀 카드를 걷어내고 에이전트를 화면의 기본 단위로 삼는다. 팀은 위쪽 칩 필터로만
 * 남는다 — 요청이 "팀별 묶음이 아니라 독립적인 주체로 보고 싶다"였다.
 */

export type AgentCardMember = {
  agent: string;
  role: string;
  team: string;
  /** 맡은 일 한 줄. 잡 라벨 또는 폴러 라벨. */
  detail: string;
  llm: boolean;
  planned: boolean;
  /** 회사 PC 폴러면 그 id. 없으면 생사를 말하지 않는다. */
  pollerId?: string;
};

/** 막대 높이 단계 — 값이 아니라 상대 크기만 보여준다. */
const BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];

function spark(daily: number[]): string {
  const max = Math.max(...daily);
  if (max === 0) return daily.map(() => BARS[0]).join("");
  return daily
    .map((n) => BARS[Math.min(BARS.length - 1, Math.round((n / max) * 6))])
    .join("");
}

export function AgentCard({
  member,
  verdict,
  usage,
}: {
  member: AgentCardMember;
  /** `system-status` 가 내린 판정. 없으면 생사를 말하지 않는다. */
  verdict?: string;
  usage: AgentUsage;
}) {
  const stopped = verdict === "stopped";
  return (
    /* 요약 판보다 옅은 테두리 — 위가 한 판이고 여기가 그 아래 개체들이라는 걸
       선 굵기로 말한다. 둘이 같은 톤이면 두 층이 한 층으로 보인다. */
    <section className="flex flex-col gap-2 border border-line-soft bg-situation-bg p-3.5">
      <div className="flex items-baseline gap-1.5">
        <span className="min-w-0 truncate font-mono text-xs text-ink">
          {member.agent}
        </span>
        {member.llm && (
          <span title="LLM 이 판단하는 자리" className="text-2xs text-vermilion">
            ✦
          </span>
        )}
        <span className="ml-auto shrink-0 text-2xs text-muted">
          {member.team}
        </span>
      </div>

      <p className="truncate text-2xs text-muted">{member.detail || member.role}</p>

      <div className="flex items-center gap-1.5">
        {member.planned ? (
          <span className="border border-line-soft px-1.5 py-0.5 text-2xs text-muted">
            예정
          </span>
        ) : (
          verdict && (
            <span
              className={`px-1.5 py-0.5 text-2xs ${
                stopped
                  ? "bg-vermilion/10 text-vermilion"
                  : "bg-line-soft text-ink-soft"
              }`}
            >
              {stopped ? "멈춤" : "처리 중"}
            </span>
          )
        )}

        {/* 셀 수 없는 자리를 0건으로 그리면 '안 돌았다'로 읽힌다. */}
        <span className="ml-auto shrink-0 text-2xs text-muted">
          {usage.today === null ? (
            "기록 없음"
          ) : (
            <>
              오늘{" "}
              <b className="tabular-nums text-ink">{usage.today}</b>건
            </>
          )}
        </span>
      </div>

      {usage.daily && (
        <div
          className="font-mono text-xs leading-none text-ink-soft"
          title={`최근 ${usage.daily.length}일 — ${usage.daily.join(" · ")}`}
        >
          {spark(usage.daily)}
        </div>
      )}
    </section>
  );
}
