"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InspectorPanel } from "../../_components/inspector/InspectorPanel";
import { AgentKpi } from "./AgentKpi";
import type { AgentRow } from "./agent-row";
import type { AgentUsage } from "@/features/agent-org/usage";
import { getAgentActivity } from "@/features/agent-org/activity";
import type { ActivityItem } from "@/features/agent-org/activity-shape";
import { kstFormat } from "@/lib/kst-format";

/**
 * 에이전트 관제탑 — 요약 한 판 + 목록 + 인스펙터.
 *
 * 팀 카드로 묶어 보여주던 정적 조직도를 걷었다. 요청이 "팀별 자동화 묶음이 아니라
 * 시스템을 운영하는 독립적인 주체로 보고 싶다"였다. 화면의 기본 단위는 에이전트
 * 하나이고 **팀은 거르는 수단으로만** 남는다.
 *
 * 개체를 카드로 깔았다가 목록으로 바꿨다 — 위쪽 요약도 카드고 아래도 카드라
 * 두 층이 한 층으로 보였다. 요약은 한 판, 개체는 줄, 상세는 우측 인스펙터다.
 */

const timeFmt = kstFormat({ hour: "2-digit", minute: "2-digit" });
const dateFmt = kstFormat({ month: "2-digit", day: "2-digit" });

/** 결과 한 마디. '건너뜀'은 실패가 아니다 — 자동 실행이 꺼져 있었을 뿐이다. */
const OUTCOME_LABEL: Record<string, string> = {
  ok: "완료",
  fail: "실패",
  skip: "건너뜀",
  running: "도는 중",
  pending: "대기",
};

/** 막대 높이 — 값이 아니라 상대 크기만 보여준다. */
const BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];
function spark(daily: number[]): string {
  const max = Math.max(...daily);
  if (max === 0) return daily.map(() => BARS[0]).join("");
  return daily
    .map((n) => BARS[Math.min(BARS.length - 1, Math.round((n / max) * 6))])
    .join("");
}

/** 오늘이면 시각, 아니면 날짜. 목록에서 한 칸에 들어가야 한다. */
function lastLabel(iso: string | null): string {
  if (!iso) return "기록 없음";
  const d = new Date(iso);
  const today = dateFmt.format(new Date());
  return dateFmt.format(d) === today ? timeFmt.format(d) : dateFmt.format(d);
}

export function AgentBoard({
  members,
  verdicts,
  usage,
  team,
}: {
  members: AgentRow[];
  /** 폴러 id → 판정. `system-status` 가 내린 것을 받아 적기만 한다. */
  verdicts: Record<string, string>;
  usage: Record<string, AgentUsage>;
  /** 고른 팀. 없으면 전체. */
  team?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  /**
   * 에이전트별 최근 활동. 인스펙터를 열 때만 가져오고, 한 번 받은 건 남겨 둔다 —
   * 행을 오가며 볼 때 같은 것을 다시 부르지 않는다.
   *
   * effect 안에서 **동기 setState 를 하지 않는다**(react-hooks/set-state-in-effect).
   * '읽는 중'은 상태를 비워서가 아니라 **캐시에 아직 없음**으로 판정한다.
   */
  const [activityByAgent, setActivityByAgent] = useState<
    Record<string, ActivityItem[]>
  >({});

  useEffect(() => {
    if (!selected || activityByAgent[selected]) return;
    let alive = true;
    void getAgentActivity(selected).then((items) => {
      if (alive) setActivityByAgent((prev) => ({ ...prev, [selected]: items }));
    });
    return () => {
      alive = false;
    };
  }, [selected, activityByAgent]);

  const activity = selected ? (activityByAgent[selected] ?? null) : null;

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
  const countable = members.filter((m) => usage[m.agent]?.today !== null && usage[m.agent] !== undefined).length;

  const current = members.find((m) => m.agent === selected) ?? null;

  return (
    <div className="flex flex-col">
      {/* 지표는 각자 카드. 붙여 놓으면 한 덩어리로 읽혀 개별 값이 안 들어온다. */}
      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        <AgentKpi label="에이전트" value={members.length} note={`팀 ${teams.length}`} />
        <AgentKpi
          label="도는 중"
          value={working}
          note={`회사 PC 폴러 ${withPoller.length}개 기준`}
        />
        <AgentKpi
          label="멈춤"
          value={stopped}
          note={stopped > 0 ? "확인 필요" : "이상 없음"}
          alert={stopped > 0}
          testId="kpi-stopped"
        />
        <AgentKpi
          label="오늘 실행"
          value={todayTotal}
          note={`기록 있는 ${countable}개 기준`}
        />
      </div>

      {/* 다른 목록 메뉴(ListPattern)와 같은 규격 — text-xl 제목 + · + N건(vermilion),
          header mb-4. 이 화면만 작으면 같은 성격의 화면이 달라 보인다. */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold text-ink">에이전트</h2>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion">{shown.length}건</span>
        </div>
        {/* 운영부 뉴스 키워드 칩과 같은 모양 — 활성 솔리드, 건수 괄호, 우측 정렬 */}
        <div
          role="group"
          aria-label="팀 필터"
          className="ml-auto flex flex-wrap items-center gap-1"
        >
          <Chip href="/dashboard/agents" active={!team}>
            전체 ({members.length})
          </Chip>
          {teams.map((t) => (
            <Chip
              key={t}
              href={`/dashboard/agents?team=${encodeURIComponent(t)}`}
              active={team === t}
            >
              {t} ({members.filter((m) => m.team === t).length})
            </Chip>
          ))}
        </div>
      </header>

      {/* 열이 일곱이라 좁은 화면에서 고정폭들이 눌려 깨졌다. 다른 목록 표와 같이
          표만 가로 스크롤한다 — 페이지 전체가 밀리면 안 된다. */}
      <div data-testid="agent-scroll" className="overflow-x-auto">
        {/* 머리글 — 숫자만 있고 무엇인지 없으면 못 읽는다. */}
        <div
          data-testid="agent-thead"
          className="flex min-w-[820px] items-center gap-3 border-b border-line px-3 py-2 text-left text-xs uppercase tracking-[0.06em] text-muted"
        >
          <span data-col="팀" className="w-16 shrink-0">
            팀
          </span>
          <span data-col="맡은 일" className="min-w-0 flex-1">
            맡은 일
          </span>
          <span data-col="상태" className="w-24 shrink-0">
            상태
          </span>
          <span data-col="구동" className="w-20 shrink-0">
            구동
          </span>
          <span data-col="오늘" className="w-14 shrink-0 text-right">
            오늘
          </span>
          <span data-col="7일" className="w-20 shrink-0 text-right">
            7일
          </span>
          <span data-col="마지막" className="w-20 shrink-0 text-right">
            마지막
          </span>
        </div>

        {shown.map((m) => {
          const u = usage[m.agent];
          const verdict = m.pollerId ? verdicts[m.pollerId] : undefined;
          return (
            <button
              key={m.agent}
              type="button"
              onClick={() => setSelected(m.agent)}
              className={`flex w-full min-w-[820px] items-center gap-3 border-b border-line-soft px-3 py-2.5 text-left transition-colors ${
                selected === m.agent
                  ? "border-vermilion bg-vermilion/10"
                  : "hover:bg-line-soft"
              }`}
            >
              <span className="w-16 shrink-0 truncate text-2xs text-muted">
                {m.team}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-ink">
                  {m.detail || m.role}
                  {m.llm && <span className="ml-1 text-vermilion">✦</span>}
                </span>
                <span className="block truncate font-mono text-2xs text-muted">
                  {m.agent}
                </span>
              </span>
              <span className="w-24 shrink-0 text-2xs">
                {m.planned ? (
                  <span className="text-muted">예정</span>
                ) : verdict ? (
                  <span
                    className={
                      verdict === "stopped" ? "text-vermilion" : "text-ink-soft"
                    }
                  >
                    {/* 도는 중인 것만 깜박인다 — 멈춤은 가만히 있어야 눈에 걸린다. */}
                    <span
                      aria-hidden
                      className={
                        verdict === "stopped" ? "" : "animate-pulse"
                      }
                    >
                      ●
                    </span>{" "}
                    {verdict === "stopped" ? "멈춤" : "처리 중"}
                  </span>
                ) : null}
              </span>
              <span className="w-20 shrink-0 text-2xs text-muted">
                {m.driver}
              </span>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink">
                {u?.today === null || u === undefined ? (
                  <span className="text-2xs text-muted">—</span>
                ) : (
                  u.today
                )}
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-xs text-ink-soft">
                {u?.daily ? spark(u.daily) : ""}
              </span>
              <span className="w-20 shrink-0 text-right text-2xs text-muted">
                {lastLabel(u?.lastAt ?? null)}
              </span>
            </button>
          );
        })}
      </div>

      <InspectorPanel open={current !== null} onClose={() => setSelected(null)}>
        {current && (
          <div data-testid="agent-inspector" className="flex flex-col gap-4">
            <div>
              <p className="font-mono text-sm text-ink">{current.agent}</p>
              <p className="mt-0.5 text-xs text-muted">
                {current.detail || current.role} · {current.team}
              </p>
            </div>

            {/* 회사 PC 와 무관한 에이전트에는 연결을 말하지 않는다. */}
            {current.pollerId && verdicts[current.pollerId] && (
              <Section label="연결">
                <p
                  className={`text-sm ${
                    verdicts[current.pollerId] === "stopped"
                      ? "text-vermilion"
                      : "text-ink"
                  }`}
                >
                  {verdicts[current.pollerId] === "stopped" ? "멈춤" : "처리 중"}
                </p>
                <p className="mt-0.5 text-2xs text-muted">
                  회사 PC 폴러 · 판정은 시스템 상태 화면과 같은 기준입니다
                </p>
              </Section>
            )}

            <Section label="최근 활동">
              {activity === null ? (
                <p className="text-xs text-muted">읽는 중…</p>
              ) : activity.length === 0 ? (
                <p className="text-xs text-muted">
                  최근 활동이 없습니다. 실행 이력이 남는 자리가 아니거나 아직 안
                  돌았습니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {activity.map((a, i) => (
                    <li key={`${a.at}-${i}`} className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-2xs text-muted">
                        {timeFmt.format(new Date(a.at))}
                      </span>
                      <span
                        className={`shrink-0 text-2xs ${
                          a.outcome === "fail"
                            ? "text-vermilion"
                            : "text-ink-soft"
                        }`}
                      >
                        {OUTCOME_LABEL[a.outcome]}
                      </span>
                      {/* 실패 사유는 요약하지 않는다 — 왜 안 됐는지가 조치다. */}
                      {a.note && (
                        <span className="min-w-0 break-all text-2xs text-muted">
                          {a.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section label="사용량">
              {usage[current.agent]?.daily ? (
                <>
                  <p className="font-mono text-lg text-ink">
                    {spark(usage[current.agent]!.daily!)}
                  </p>
                  <p className="mt-1 text-2xs text-muted">
                    최근 {usage[current.agent]!.daily!.length}일 ·{" "}
                    {usage[current.agent]!.daily!.join(" · ")}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    마지막 실행 {lastLabel(usage[current.agent]!.lastAt)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">
                  실행 이력이 남지 않는 자리라 셀 수 없습니다.
                </p>
              )}
            </Section>
          </div>
        )}
      </InspectorPanel>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line-soft pt-3">
      <p className="mb-1 text-2xs uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      {children}
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
      className={`border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-vermilion bg-vermilion text-cream"
          : "border-line bg-paper text-ink hover:bg-line-soft"
      }`}
    >
      {children}
    </Link>
  );
}
