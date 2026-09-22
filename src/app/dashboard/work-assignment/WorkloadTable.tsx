import { KpiCard, type KpiCardItem } from "@/components/common/KpiCard";
import {
  TENURE_GROUP_LABELS,
  careerYearsAt,
  type TenureGroup,
} from "@/features/assignments/tenure";
import type {
  WorkloadGroup,
  WorkloadSummary,
} from "@/features/assignments/workload";
import type { UnmatchedVolume } from "@/features/assignments/workload-sources";

/**
 * 배정현황 — **§6.1 의 근거를 사람이 검산하는 자리**(설계 §9.4).
 *
 * 판정하지 않는다. 그룹 안 평균을 머리에 적고 편차가 큰 줄을 눈에 띄게 할 뿐이다.
 * 전체를 균등화하면 연차에 따라 **의도된** 차이까지 지우려 들기 때문에(§3.5),
 * 표가 '고칠 것' 을 말하는 순간 잘못된 일을 부른다.
 *
 * 골격은 **운영리포트를 옮겼다**(사용자 요구 2026-09-22 — "한눈에 안 들어온다").
 * 머리(제목·원천) → **KPI 카드 넷** → 표 → 상세. 예전에는 아홉 칸이 숫자만
 * 늘어서 있어 총량도 없고 견줄 기준도 눈에 안 들어왔다.
 *
 * **검색창과 학년도는 이 컴포넌트가 들지 않는다** — 섹션 밖 조작줄(`WorkloadControls`)
 * 이 든다. 처음엔 머리 오른쪽에 끼워 넣었는데 다른 목록 메뉴가 전부 섹션 밖 한 줄에
 * 두고 있어 **이 화면만 자리가 달랐다**(지적 2026-09-22).
 *
 * 서버 컴포넌트다 — `now` 를 서버에서 받아 경력을 계산하므로 하이드레이션에서
 * 시각이 갈리지 않는다.
 */

/**
 * 강조 임계 — 두 축의 상대 편차 **합**이라 0.4 는 '한 축이 40% 벗어났거나 두 축이
 * 20%씩' 이다. 판정이 아니라 눈길을 주는 선이고, 넘었다고 옮겨야 하는 것은 아니다.
 */
const DEVIATION_THRESHOLD = 0.4;

/**
 * 일곱 칸. **아홉에서 줄였다**(사용자 요구 2026-09-22).
 *
 * `그룹` 은 머리행이 `2그룹 · 목표 …` 로 이미 말한다. `경력` 은 상세로 내렸다 —
 * 견주는 숫자가 아니라 사람을 설명하는 값이고, 그룹 머리가 이미 연차를 말한다.
 * `올해` 는 **`서비스 건수` 와 거의 같은 값**이라(둘 다 그 학년도 전량) 나란히
 * 두면 다른 것을 센 줄 알고 둘을 비교하게 된다.
 *
 * 뒤 두 칸은 `주`·`월` 이었다. 한 글자로는 **무엇을 센 숫자인지 알 수 없어**,
 * 숫자는 보이는데 뜻이 없었다.
 */
const COLUMNS = [
  "이름",
  "대학 수",
  "서비스 건수",
  "밀도",
  "목표 대비",
  "이번 주",
  "이번 달",
] as const;

/** 이름만 왼쪽이다. 나머지는 견주는 숫자라 오른쪽으로 맞춘다. */
const LEFT_COLUMNS = 1;

/** `toFixed` 만 쓰면 5.35 가 5.3 으로 내려간다(부동소수). 먼저 반올림한다. */
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

const groupLabel = (group: string) =>
  TENURE_GROUP_LABELS[group as TenureGroup] ?? group;

/**
 * 그룹 머리 한 줄. **한 텍스트 노드로 만든다** — 숫자만 `<b>` 로 감싸면
 * `getNodeText` 가 직계 텍스트만 이어 붙여 '20곳' 이 검사에서 사라진다.
 */
const headText = (g: WorkloadGroup) =>
  g.target
    ? `${groupLabel(g.group)} · 목표 ${oneDecimal(g.target.universities)}곳 · 밀도 ${oneDecimal(g.target.density)}`
    : `${groupLabel(g.group)} · 목표 없음 — 연차 그룹이 비어 있습니다`;

/** `2026-09-15` → `09.15`. 같은 해 안에서 보는 표라 연도는 접는다. */
const shortDay = (day: string) => day.slice(5).replace("-", ".");

/** 비교 대상(직전 기간)이 없는 화면이라 delta 는 전부 null 이다(운영리포트 관례). */
const kpi = (
  label: string,
  value: number,
  unit: string,
  goodOnIncrease = true,
): KpiCardItem => ({
  label,
  value,
  unit,
  delta: null,
  deltaPct: null,
  prevValue: null,
  goodOnIncrease,
});

/**
 * 원천 한 줄. **화면이 자기 원천을 말해야 한다.**
 *
 * 2026학년도 2,511건에서 2027학년도 983건으로 떨어지는데, 말 안 하면 **물량이 60%
 * 줄었다**고 읽는다 — 실제로는 표가 바뀐 것이다(`services` 는 2026-02-28 에 멈춘
 * 시트 임포트, `closing_services` 는 스크랩을 시작한 뒤부터 쌓이는 미러).
 *
 * **담당자는 두 해 모두 배정 원장이다**(#1215). 그 전에는 과거 학년도만
 * `services.operator_email` 을 봤고 이 줄이 "담당자도 그쪽 기록입니다" 였다.
 */
const sourceNote = (isPast: boolean) =>
  isPast
    ? "건수 원천: 서비스목록(services) · 담당자: 배정 원장 — 연차 그룹은 오늘 값 하나뿐이라 지난 해에는 목표·편차를 내지 않습니다."
    : "건수 원천: 서비스마감(closing_services) · 담당자: 배정 원장";

/**
 * 목표 대비 막대 — **숫자만으로는 스무 줄을 눈으로 견줘야 한다**(사용자 선택
 * 2026-09-22). 목표가 없는 그룹에는 그리지 않는다: 기준 없는 막대는 거짓말이다.
 *
 * 너비는 인라인 `style` 이다 — 값이 런타임에 정해져 Tailwind 클래스로 만들 수 없다
 * (레포의 진행률 막대 8곳이 같은 방식이다).
 */
function TargetBar({ name, deviation }: { name: string; deviation: number }) {
  const pct = Math.round(deviation * 100);
  const loud = deviation >= DEVIATION_THRESHOLD;
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="tabular-nums">{pct}%</span>
      <div
        role="meter"
        aria-label={`${name} 목표 대비`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-14 shrink-0 border border-line bg-cream"
      >
        <div
          className={`h-full ${loud ? "bg-vermilion" : "bg-sage"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 이번 달 진행 상세 — 사용자가 원한 *"주간/월별 통계 **및 상세 리스트**"* 의 뒷쪽.
 *
 * 표 안에 접어 넣지 않고 아래 절로 뺀다. 표는 **견주는 자리**(그룹 목표 대비
 * 편차)이고 이쪽은 **들여다보는 자리**라, 한 표에 섞으면 열이 스무 개가 되고
 * 둘 다 안 읽힌다. `<details>` 라 기본은 접혀 있고 클라이언트 코드가 없다.
 *
 * **경력이 여기 있다** — 표에서 내렸을 뿐 지운 것이 아니다.
 */
function RunningSection({
  groups,
  now,
}: {
  groups: WorkloadGroup[];
  now: Date;
}) {
  const rows = groups.flatMap((g) => g.rows);
  return (
    <section className="mt-6">
      <header className="mb-4">
        {/*
         * 표 위 제목은 `text-xl font-bold` 다(`panel-heading-standard`). 작은 제목은
         * 표를 끌어당겨 같은 여백도 좁아 보인다 — 운영리포트의 `저장된 리포트` 와
         * 같은 자리, 같은 크기다.
         */}
        <h3 className="text-xl font-bold text-ink">이번 달 진행 상세</h3>
        <p className="mt-1 text-xs text-muted">
          이름을 펼치면 그 달에 도는 서비스가 보입니다. `이번 주` 는 월요일부터
          일요일까지와 겹치는 것입니다.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const career = careerYearsAt(r.careerStart, now);
          return (
            <details
              key={r.email}
              className="border border-line-soft bg-paper px-3 py-2"
            >
              <summary className="cursor-pointer text-sm text-ink">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted tabular-nums">
                  {career === null ? "경력 —" : `경력 ${oneDecimal(career)}년`}{" "}
                  · 담당 {r.universities}곳 · 이번 주 {r.week}건 · 이번 달{" "}
                  {r.month}건
                </span>
              </summary>
              {r.running.length === 0 ? (
                <p className="mt-2 text-xs text-muted">
                  이번 달에 도는 서비스가 없습니다
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-line-soft text-muted">
                        <th scope="col" className="px-2 py-1 font-normal">
                          대학
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          서비스
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          업무종류
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          접수기간
                        </th>
                        <th scope="col" className="px-2 py-1 font-normal">
                          주
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.running.map((s) => (
                        <tr
                          key={`${s.university_name}|${s.service_name}|${s.start}`}
                          className="border-b border-line-soft last:border-0"
                        >
                          <td className="px-2 py-1 text-ink">
                            {s.university_name}
                          </td>
                          <td className="px-2 py-1 text-ink">
                            {s.service_name}
                          </td>
                          <td className="px-2 py-1 text-muted">
                            {s.work_kind}
                          </td>
                          <td className="px-2 py-1 text-muted">
                            {shortDay(s.start)} ~ {shortDay(s.end)}
                          </td>
                          <td className="px-2 py-1">
                            {s.inWeek && (
                              <span className="border border-vermilion bg-vermilion/10 px-1.5 py-0.5 text-vermilion">
                                이번 주
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function WorkloadTable({
  groups,
  summary,
  now,
  academicYear,
  isPast,
  unmatched,
  query,
}: {
  /** 검색이 걸러낸 줄. 그룹의 `target` 은 전원으로 낸 값 그대로다. */
  groups: WorkloadGroup[];
  /** **전원 기준** 총량 — 검색과 무관하다(`summarizeWorkload`). */
  summary: WorkloadSummary;
  now: Date;
  academicYear: number;
  isPast: boolean;
  unmatched: UnmatchedVolume;
  /** 지금 걸린 검색어. 빈 결과를 '아무도 없다' 와 가르는 데 쓴다. */
  query: string;
}) {
  const searching = query.trim() !== "";

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold text-ink">배정현황</h2>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion tabular-nums">
            {academicYear}학년도
          </span>
        </div>
        <p className="text-xs text-muted">{sourceNote(isPast)}</p>
      </header>

      {/*
       * 카드 넷은 **전원 기준**이다. 검색으로 좁힌 줄로 내면 한 사람을 찾을 때
       * '배정 대상 1명' 이 되어 요약이 요약을 그만둔다.
       *
       * `안 붙음` 이 0 이어도 카드를 뺀 자리를 비우지 않는다 — 카드가 사라지면 넷이
       * 셋이 되어 자리가 흔들리고, 0 이라는 사실 자체가 알릴 값이다.
       */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard item={kpi("배정 대상", summary.people, "명")} />
        <KpiCard item={kpi("담당 대학", summary.universities, "곳")} />
        <KpiCard item={kpi("서비스 물량", summary.services, "건")} />
        <KpiCard item={kpi("안 붙음", unmatched.services, "건", false)} />
      </div>

      {/*
       * **안 붙은 건수를 조용히 빼지 않는다.** 표의 합만 보면 멀쩡해서, 마감 983건
       * 중 231건(23.5%)이 어느 담당자에게도 안 붙어 있던 것을 아무도 못 봤다
       * (실측 2026-09-21). 카드가 숫자를 들고, 이 줄은 무엇을 하라고 말한다.
       */}
      {unmatched.services > 0 && (
        <p className="mb-2 text-xs text-vermilion">
          어느 담당자에게도 안 붙은 건수{" "}
          <span className="tabular-nums">{unmatched.services}건</span> ·{" "}
          <span className="tabular-nums">{unmatched.keys}곳</span> — 배정 시트에
          그 대학의 해당 업무 칸이 없거나, 원천이 다른 이름으로 부르는 것입니다.
          원서접수·대학원은 신규배정 탭에 서고, 발표(PIMS)는 배정 시트를 봐야
          합니다.
        </p>
      )}

      {groups.length === 0 ? (
        <div className="border border-dashed border-line-soft bg-situation-bg p-8 text-center">
          {/*
           * 검색 결과가 빈 것과 아무도 없는 것은 **다른 사건**이다. 섞으면 찾는
           * 말이 없을 때 조직 설정을 보러 간다.
           */}
          <p className="text-sm text-muted">
            {searching
              ? `‘${query.trim()}’ 로 찾지 못했습니다 — 담당자 이름이나 담당 대학으로 찾습니다.`
              : isPast
                ? `${academicYear}학년도는 원장에 배정이 없습니다 — 총괄장에서 적재하세요.`
                : "배정 대상이 없습니다 — 조직 · 권한에서 배정 대상을 켜세요."}
          </p>
        </div>
      ) : (
        <>
          {/*
           * **색이 무엇을 뜻하는지 화면이 말해야 한다.** 강조만 있고 범례가 없으면
           * 그 줄이 왜 붉은지 물어볼 곳이 없고, 사람은 색을 '나쁨' 으로만 읽는다 —
           * 임계를 넘었다는 것이지 옮겨야 한다는 뜻이 아니다.
           */}
          <p className="mb-2 text-xs text-muted">
            붉은 줄은{" "}
            <b className="font-medium text-vermilion-deep">
              목표 대비 {Math.round(DEVIATION_THRESHOLD * 100)}% 이상
            </b>{" "}
            벗어난 사람입니다 — 눈길을 주는 선이고, 넘었다고 옮겨야 하는 것은
            아닙니다.
          </p>
          {/* `올해` 열을 걷은 이유를 적는다 — 건수가 무슨 기간인지 모르면 못 읽는다. */}
          <p className="mb-2 text-xs text-muted">
            서비스 건수는 그 학년도 전량이고, `이번 주`·`이번 달` 은 그 기간에
            겹치는 서비스 수입니다.
          </p>
          <div className="overflow-x-auto border border-line-soft bg-paper">
            <table className="w-full text-left text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line-soft text-xs text-muted">
                  {COLUMNS.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`px-3 py-2 font-normal ${i < LEFT_COLUMNS ? "" : "text-right"}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.group}>
                  <tr className="border-b border-line-soft bg-situation-bg">
                    <th
                      scope="colgroup"
                      colSpan={COLUMNS.length}
                      className="px-3 py-2 text-left text-xs font-medium text-ink"
                    >
                      {headText(g)}
                    </th>
                  </tr>
                  {g.rows.map((r) => {
                    const loud =
                      r.deviation !== null &&
                      r.deviation >= DEVIATION_THRESHOLD;
                    return (
                      <tr
                        key={r.email}
                        className={`border-b border-line-soft ${
                          loud ? "bg-vermilion/10 text-vermilion-deep" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-ink">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.universities}
                        </td>
                        {/* 못 센 칸을 같은 텍스트 노드에 적는다 — 0 이 '일이 없다' 로 읽히면 안 된다. */}
                        <td className="px-3 py-2 text-right">
                          {r.uncounted === 0
                            ? `${r.services}`
                            : `${r.services} (${r.uncounted}칸 못 셈)`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {oneDecimal(r.density)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.deviation === null ? (
                            "—"
                          ) : (
                            <TargetBar name={r.name} deviation={r.deviation} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{r.week}</td>
                        <td className="px-3 py-2 text-right">{r.month}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          <RunningSection groups={groups} now={now} />
        </>
      )}
    </>
  );
}
