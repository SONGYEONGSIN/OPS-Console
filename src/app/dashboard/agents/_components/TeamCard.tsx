import { statusBadgeTone } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
import type { ResolvedTeam } from "@/features/agent-org/resolve";

/**
 * 미구현 자리 라벨. '준비 중'을 쓰면 '중'으로 끝나 공통 규칙이 진행(빨강)으로
 * 판정한다 — 대기(회색)로 보이게 하려면 이 라벨이라야 한다.
 */
const PLANNED_LABEL = "예정";

/** 성향 칩 — 누를 수 없으므로 호버·선택 인터랙션 표준을 적용하지 않는다. */
function TraitChip({ label }: { label: string }) {
  return (
    <span className="inline-block border border-line-soft px-1.5 py-0.5 text-2xs text-muted">
      {label}
    </span>
  );
}

export function TeamCard({
  team,
  pollerVerdicts = {},
}: {
  team: ResolvedTeam;
  /**
   * 폴러 id → 판정. 없는 키는 '모름'이고 배지를 안 붙인다.
   *
   * 판정 자체는 `system-status/verdict.ts` 가 큐 나이 → 심박 순으로 내린다.
   * 화면이 다시 판정하지 않는다 — 두 벌이 되면 설정 화면과 답이 갈린다.
   */
  pollerVerdicts?: Record<string, string>;
}) {
  return (
    <section className="flex flex-col gap-3 border border-line bg-situation-bg p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{team.name}</h2>
        <span className="text-xs text-muted">{team.leaderName}</span>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">{team.tagline}</p>

      <div className="flex flex-wrap gap-1">
        {team.traits.map((t) => (
          <TraitChip key={t} label={t} />
        ))}
      </div>

      <div className="border-t border-line-soft pt-3">
        <p className="mb-2 text-2xs uppercase tracking-[0.18em] text-muted">
          팀원
        </p>
        {team.members.length === 0 ? (
          <p className="text-xs text-muted">직접 수행</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {team.members.map((m) => (
              <li key={m.agent} className="flex items-start gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted">{m.role}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-ink">{m.agent}</span>
                    {m.llm && (
                      <span
                        title="LLM으로 판단합니다"
                        className="text-vermilion"
                        aria-label="LLM으로 판단합니다"
                      >
                        ✦
                      </span>
                    )}
                    {m.pollerId && pollerVerdicts[m.pollerId] && (
                      /* 회사 PC 에서 도는 에이전트는 살아 있는지가 먼저다.
                         판정이 없으면 아무 말도 안 한다 — 모르면서 정상이라
                         하지 않는 건 verdict.ts 의 'unknown' 과 같은 태도다. */
                      <span
                        className={`shrink-0 px-1.5 py-0.5 text-2xs ${
                          pollerVerdicts[m.pollerId] === "stopped"
                            ? "bg-vermilion/10 text-vermilion"
                            : "bg-line-soft text-ink-soft"
                        }`}
                      >
                        {pollerVerdicts[m.pollerId] === "stopped"
                          ? "멈춤"
                          : "처리 중"}
                      </span>
                    )}
                    {m.planned && (
                      <span
                        className={`inline-block px-1.5 py-0.5 text-2xs ${statusBadgeTone(PLANNED_LABEL)}`}
                      >
                        {PLANNED_LABEL}
                      </span>
                    )}
                  </span>
                  {m.detail && (
                    <span className="block text-2xs text-faint">
                      {m.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
