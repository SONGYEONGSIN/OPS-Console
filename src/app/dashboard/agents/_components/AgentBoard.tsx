"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Section,
  DefList,
  Divider,
} from "../../_components/inspector/list-variants/shared";
import { agentStatus } from "@/features/agent-org/agent-status";
import type { AgentCost } from "@/features/agent-org/cost-fold";
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
  cost = {},
  team,
}: {
  members: AgentRow[];
  /** 폴러 id → 판정. `system-status` 가 내린 것을 받아 적기만 한다. */
  verdicts: Record<string, string>;
  usage: Record<string, AgentUsage>;
  /** 에이전트별 토큰·비용. 안 남는 곳은 null — 0 이 아니다. */
  cost?: Record<string, AgentCost | null>;
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
        {/* 다른 목록과 같은 진짜 표다. div+flex 였을 때 `맡은 일` 이 flex-1 이라
            남는 폭을 통째로 먹어, 넓은 화면에서 그 열과 옆 열 사이가 크게 비었다.
            표는 남는 폭을 여러 열에 나눠 붙인다. */}
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            {/* <th> 는 브라우저 기본이 볼드다(preflight 는 h1~h6 만 리셋한다).
                #1139 에서 손으로 font-bold 를 붙였던 건 여기가 div+span 이라
                그 기본이 없었기 때문 — 진짜 표가 된 지금은 군더더기고,
                table-head-cell-standard 가드가 그걸 막는다. */}
            <tr
              data-testid="agent-thead"
              className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted"
            >
              <th data-col="팀" className="px-3 py-2">
                팀
              </th>
              <th data-col="맡은 일" className="px-3 py-2">
                맡은 일
              </th>
              {/* 구동 = 어떻게 도는가 + 지금 어떤가. 예전엔 '상태' 를 따로 뒀는데
                  폴러에만 값이 있어 잡 20여 개는 영영 빈 칸이었다. */}
              <th data-col="구동" className="px-3 py-2">
                구동
              </th>
              <th data-col="오늘" className="px-3 py-2 text-right">
                오늘
              </th>
              {/* 막대는 그 에이전트 자기 최대값 기준이라(spark 의 n/max) 144건짜리와
                  1건짜리의 가장 높은 막대가 같은 높이다. 머리글이 `7일` 뿐이면
                  행끼리 비교하게 된다. */}
              <th
                data-col="7일"
                title="최근 7일 일별 실행 건수. 막대 높이는 그 에이전트 자기 최대값 기준이라 행끼리 견주면 틀립니다."
                className="px-3 py-2 text-right"
              >
                7일 추이
              </th>
              <th data-col="마지막" className="px-3 py-2 text-right">
                마지막
              </th>
              {/* 비 LLM 22개는 비용 개념 자체가 없다. 거기에 대시를 채우면
                  '못 셌다'로 읽혀 노이즈가 된다 — 빈칸으로 둔다. */}
              <th
                data-col="비용"
                title="최근 7일 합계(USD). LLM 을 쓰는 에이전트만 해당하고, 대시는 아직 토큰이 안 남는 곳입니다."
                className="px-3 py-2 text-right"
              >
                비용
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const u = usage[m.agent];
              const c = cost[m.agent];
              const verdict = m.pollerId ? verdicts[m.pollerId] : undefined;
              return (
                <tr
                  key={m.agent}
                  onClick={() => setSelected(m.agent)}
                  className={`cursor-pointer border-b border-line-soft transition-colors ${
                    selected === m.agent
                      ? "border-vermilion bg-vermilion/10"
                      : "hover:bg-line-soft"
                  }`}
                >
                  <td className="px-3 py-2.5 text-ink-soft">{m.team}</td>
                  <td className="px-3 py-2.5">
                    <span className="block text-ink">
                      {m.detail || m.role}
                      {m.llm && <span className="ml-1 text-vermilion">✦</span>}
                    </span>
                    <span className="block font-mono text-2xs text-muted">
                      {m.agent}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block text-ink-soft">
                      {m.planned ? "예정" : m.driver}
                    </span>
                    {verdict ? (
                      <span
                        className={`block text-2xs ${
                          verdict === "stopped"
                            ? "text-vermilion"
                            : "text-ink-soft"
                        }`}
                      >
                        {/* 도는 중인 것만 깜박인다 — 멈춤은 가만히 있어야 눈에 걸린다. */}
                        <span
                          aria-hidden
                          className={verdict === "stopped" ? "" : "animate-pulse"}
                        >
                          ●
                        </span>{" "}
                        {verdict === "stopped" ? "멈춤" : "처리 중"}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {u?.today === null || u === undefined ? (
                      <span className="text-2xs text-muted">—</span>
                    ) : (
                      u.today
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-soft">
                    {u?.daily ? spark(u.daily) : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-soft">
                    {lastLabel(u?.lastAt ?? null)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {!m.llm ? "" : c ? `$${c.costUsd.toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InspectorPanel open={current !== null} onClose={() => setSelected(null)}>
        {current && (
          <div data-testid="agent-inspector" className="flex flex-col gap-6">
            {/* 다른 메뉴 인스펙터(InspectorChrome)와 같은 머리 — 눈썹 문구,
                굵은 제목, 아래 굵은 구분선. 여기만 자체 머리라 제목이 본문
                글씨만 하고 구분선이 없어 어디까지가 머리인지 안 보였다.
                상태 뱃지·편집 토글은 안 붙인다 — 에이전트에는 그 개념이
                없고, 흉내 내면 없는 상태를 있는 것처럼 그리게 된다. */}
            <header className="border-b-2 border-ink pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                    인스펙터 · 에이전트
                  </p>
                  <h3 className="mt-1 text-xl font-bold tracking-[-0.01em] text-ink">
                    {current.detail || current.role}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-mono">{current.agent}</span> ·{" "}
                    {current.team}
                  </p>
                </div>
                {/* 아는 것만 적는다 — '가동'이라고 적어 놓고 한 달째 안 돈
                    잡이면 뱃지가 사람을 속인다(agent-status.ts). */}
                {(() => {
                  const st = agentStatus({
                    planned: current.planned,
                    verdict: current.pollerId
                      ? verdicts[current.pollerId]
                      : undefined,
                    lastAt: usage[current.agent]?.lastAt ?? null,
                  });
                  return (
                    <div
                      aria-hidden
                      data-agent-status
                      className={`flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-full text-[10px] leading-tight text-cream ${st.ring}`}
                    >
                      <span className="text-base">★</span>
                      <span>{st.label}</span>
                    </div>
                  );
                })()}
              </div>
            </header>

            {/* 회사 PC 와 무관한 에이전트에는 연결을 말하지 않는다. */}
            {current.pollerId && verdicts[current.pollerId] && (
              <Section title="연결">
                <p
                  className={`text-sm ${
                    verdicts[current.pollerId] === "stopped"
                      ? "text-vermilion"
                      : "text-ink"
                  }`}
                >
                  {verdicts[current.pollerId] === "stopped" ? "멈춤" : "처리 중"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  회사 PC 폴러 · 판정은 시스템 상태 화면과 같은 기준입니다
                </p>
              </Section>
            )}

            {/* 구분선은 섹션 사이에만. 연결이 없는 잡에서 이게 그대로 남으면
                머리의 굵은 선 바로 밑에 얇은 선이 겹쳐 두 줄로 보인다. */}
            {current.pollerId && verdicts[current.pollerId] && <Divider />}

            <Section title="최근 활동">
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
                      <span className="shrink-0 font-mono text-xs text-muted">
                        {timeFmt.format(new Date(a.at))}
                      </span>
                      <span
                        className={`shrink-0 text-xs ${
                          a.outcome === "fail"
                            ? "text-vermilion"
                            : "text-ink-soft"
                        }`}
                      >
                        {OUTCOME_LABEL[a.outcome]}
                      </span>
                      {/* 실패 사유는 요약하지 않는다 — 왜 안 됐는지가 조치다. */}
                      {a.note && (
                        <span className="min-w-0 break-all text-xs text-muted">
                          {a.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Divider />

            <Section title="사용량">
              {usage[current.agent]?.daily ? (
                <>
                  <p className="font-mono text-lg text-ink">
                    {spark(usage[current.agent]!.daily!)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    최근 {usage[current.agent]!.daily!.length}일 ·{" "}
                    {usage[current.agent]!.daily!.join(" · ")}
                  </p>
                  {/* 여기엔 원래 값이 있으니 높이가 상대값이라는 것만 덧붙인다. */}
                  <p className="mt-1 text-xs text-muted">
                    막대는 이 에이전트 최대값 기준입니다 — 다른 에이전트와 높이를
                    견주지 마세요.
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

            {/* 비 LLM 에는 토큰 이야기를 아예 안 한다 — 비용 개념이 없는데
                '없음'이라고 적으면 못 센 것처럼 읽힌다. */}
            {current.llm && <Divider />}
            {current.llm && (
              <Section title="토큰 · 비용">
                {cost[current.agent] ? (
                  <>
                    <DefList
                      items={[
                        {
                          term: "입력",
                          desc: (
                            <span className="tabular-nums">
                              {cost[current.agent]!.inputTokens.toLocaleString()}
                            </span>
                          ),
                        },
                        {
                          term: "출력",
                          desc: (
                            <span className="tabular-nums">
                              {cost[current.agent]!.outputTokens.toLocaleString()}
                            </span>
                          ),
                        },
                        {
                          // 같은 볼트를 매번 읽으므로 캐시 적중이 비용의 대부분을
                          // 좌우한다 — 합쳐 놓으면 왜 비싼지 못 본다.
                          term: "캐시 읽기",
                          desc: (
                            <span className="tabular-nums">
                              {cost[
                                current.agent
                              ]!.cacheReadTokens.toLocaleString()}
                            </span>
                          ),
                        },
                        {
                          term: "비용",
                          desc: (
                            <span className="tabular-nums">
                              ${cost[current.agent]!.costUsd.toFixed(2)}
                            </span>
                          ),
                        },
                        {
                          term: "모델",
                          desc: (
                            <span className="font-mono text-xs">
                              {cost[current.agent]!.model}
                            </span>
                          ),
                        },
                      ]}
                    />
                    <p className="text-xs text-muted">
                      최근 7일 · 실행{" "}
                      <span className="tabular-nums">
                        {cost[current.agent]!.runs}
                      </span>
                      건 기준
                    </p>
                  </>
                ) : current.agent in cost ? (
                  /* 수집 경로는 있다 — 회사 PC 가 갱신되면 채워진다. */
                  <p className="text-xs text-muted">
                    토큰이 아직 안 쌓였습니다. 수집 경로는 열려 있으니 회사 PC
                    폴러가 갱신되면 채워집니다.
                  </p>
                ) : (
                  /* 남길 자리가 아예 없다 — 고칠 곳이 위와 다르다. */
                  <p className="text-xs text-muted">
                    토큰을 남길 자리가 없습니다. 이 에이전트는 회사 PC 에서
                    claude CLI 를 부르는데 그쪽은 사용량을 돌려주지 않습니다 —
                    이력 테이블에 컬럼을 만들고 스크립트가 적재해야 값이 생깁니다.
                  </p>
                )}
              </Section>
            )}
          </div>
        )}
      </InspectorPanel>
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
