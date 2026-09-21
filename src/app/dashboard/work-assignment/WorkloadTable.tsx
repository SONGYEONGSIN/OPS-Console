import {
  TENURE_GROUP_LABELS,
  careerYearsAt,
  type TenureGroup,
} from "@/features/assignments/tenure";
import type { WorkloadGroup } from "@/features/assignments/workload";
import type { UnmatchedVolume } from "@/features/assignments/workload-sources";

/**
 * 배분현황 — **§6.1 의 근거를 사람이 검산하는 자리**(설계 §9.4).
 *
 * 판정하지 않는다. 그룹 안 평균을 머리에 적고 편차가 큰 줄을 눈에 띄게 할 뿐이다.
 * 전체를 균등화하면 연차에 따라 **의도된** 차이까지 지우려 들기 때문에(§3.5),
 * 표가 '고칠 것' 을 말하는 순간 잘못된 일을 부른다.
 *
 * 서버 컴포넌트다 — `now` 를 서버에서 받아 경력을 계산하므로 하이드레이션에서
 * 시각이 갈리지 않는다.
 */

/**
 * 강조 임계 — 두 축의 상대 편차 **합**이라 0.4 는 '한 축이 40% 벗어났거나 두 축이
 * 20%씩' 이다. 판정이 아니라 눈길을 주는 선이고, 넘었다고 옮겨야 하는 것은 아니다.
 */
const DEVIATION_THRESHOLD = 0.4;

const COLUMNS = [
  "이름",
  "그룹",
  "경력",
  "대학 수",
  "서비스 건수",
  "밀도",
  "목표 대비",
  "주",
  "월",
  "연",
] as const;

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

/**
 * 학년도 칩 + 원천 안내.
 *
 * **원천을 화면이 말해야 한다.** 2026학년도 2,511건에서 2027학년도 983건으로
 * 떨어지는데, 말 안 하면 **물량이 60% 줄었다**고 읽는다 — 실제로는 표가 바뀐
 * 것이다(`services` 는 2026-02-28 에 멈춘 시트 임포트, `closing_services` 는
 * 스크랩을 시작한 뒤부터 쌓이는 미러).
 */
function YearBar({
  academicYear,
  years,
  isPast,
  unmatched,
}: {
  academicYear: number;
  years: readonly number[];
  isPast: boolean;
  unmatched: UnmatchedVolume;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <nav aria-label="학년도" className="flex gap-1">
        {years.map((y) =>
          y === academicYear ? (
            <span
              key={y}
              aria-current="page"
              className="border border-vermilion bg-vermilion/10 px-3 py-1 text-xs text-vermilion tabular-nums"
            >
              {y}학년도
            </span>
          ) : (
            <a
              key={y}
              href={`/dashboard/work-assignment?tab=workload&year=${y}`}
              className="border border-line-soft px-3 py-1 text-xs text-muted tabular-nums hover:bg-line-soft"
            >
              {y}학년도
            </a>
          ),
        )}
      </nav>
      <p className="text-xs text-muted">
        {isPast
          ? "건수 원천: 서비스목록(services) — 담당자도 그쪽 기록입니다. 연차 그룹은 오늘 값 하나뿐이라 지난 해에는 목표·편차를 내지 않습니다."
          : "건수 원천: 서비스마감(closing_services) · 담당자: 배정 원장"}
      </p>
      {/*
       * **안 붙은 건수를 조용히 빼지 않는다.** 표의 합만 보면 멀쩡해서, 마감 983건
       * 중 231건(23.5%)이 어느 담당자에게도 안 붙어 있던 것을 아무도 못 봤다
       * (실측 2026-09-21). 0 일 때는 안 띄운다 — 알릴 것이 없다.
       */}
      {unmatched.services > 0 && (
        <p className="text-xs text-vermilion">
          어느 담당자에게도 안 붙은 건수{" "}
          <span className="tabular-nums">{unmatched.services}건</span> ·{" "}
          <span className="tabular-nums">{unmatched.keys}곳</span> — 배정 시트에
          없는 대학이거나 이름이 갈린 것입니다. 신규배정 탭에서 확인하세요.
        </p>
      )}
    </header>
  );
}

/**
 * 이번 달 진행 상세 — 사용자가 원한 *"주간/월별 통계 **및 상세 리스트**"* 의 뒷쪽.
 *
 * 표 안에 접어 넣지 않고 아래 절로 뺀다. 표는 **견주는 자리**(그룹 목표 대비
 * 편차)이고 이쪽은 **들여다보는 자리**라, 한 표에 섞으면 열이 스무 개가 되고
 * 둘 다 안 읽힌다. `<details>` 라 기본은 접혀 있고 클라이언트 코드가 없다.
 */
function RunningSection({ groups }: { groups: WorkloadGroup[] }) {
  const rows = groups.flatMap((g) => g.rows);
  return (
    <section className="mt-6">
      <header className="mb-4">
        <h2 className="text-sm font-medium text-ink">이번 달 진행 상세</h2>
        <p className="mt-1 text-xs text-muted">
          이름을 펼치면 그 달에 도는 서비스가 보입니다. `이번 주` 는 월요일부터
          일요일까지와 겹치는 것입니다.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <details
            key={r.email}
            className="border border-line-soft bg-paper px-3 py-2"
          >
            <summary className="cursor-pointer text-sm text-ink">
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-xs text-muted tabular-nums">
                이번 주 {r.week}건 · 이번 달 {r.month}건
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
                        <td className="px-2 py-1 text-ink">{s.service_name}</td>
                        <td className="px-2 py-1 text-muted">{s.work_kind}</td>
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
        ))}
      </div>
    </section>
  );
}

export function WorkloadTable({
  groups,
  now,
  academicYear,
  years,
  isPast,
  unmatched,
}: {
  groups: WorkloadGroup[];
  now: Date;
  academicYear: number;
  years: readonly number[];
  isPast: boolean;
  unmatched: UnmatchedVolume;
}) {
  if (groups.length === 0) {
    return (
      <>
        <YearBar
          academicYear={academicYear}
          years={years}
          isPast={isPast}
          unmatched={unmatched}
        />
        <div className="border border-dashed border-line-soft bg-situation-bg p-8 text-center">
          <p className="text-sm text-muted">
            {isPast
              ? `${academicYear}학년도는 담당자 기록이 없습니다 — 서비스목록에 운영자 메일이 비어 있습니다.`
              : "배정 대상이 없습니다 — 조직 · 권한에서 배정 대상을 켜세요."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <YearBar
          academicYear={academicYear}
          years={years}
          isPast={isPast}
          unmatched={unmatched}
        />
      <div className="overflow-x-auto border border-line-soft bg-paper">
        <table className="w-full text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line-soft text-xs text-muted">
              {COLUMNS.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`px-3 py-2 font-normal ${i === 0 || i === 1 ? "" : "text-right"}`}
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
                const years = careerYearsAt(r.careerStart, now);
                const loud =
                  r.deviation !== null && r.deviation >= DEVIATION_THRESHOLD;
                return (
                  <tr
                    key={r.email}
                    className={`border-b border-line-soft ${
                      loud ? "bg-vermilion/10 text-vermilion-deep" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-muted">
                      {groupLabel(g.group)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {years === null ? "—" : `${oneDecimal(years)}년`}
                    </td>
                    <td className="px-3 py-2 text-right">{r.universities}</td>
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
                      {r.deviation === null
                        ? "—"
                        : `${Math.round(r.deviation * 100)}%`}
                    </td>
                    <td className="px-3 py-2 text-right">{r.week}</td>
                    <td className="px-3 py-2 text-right">{r.month}</td>
                    <td className="px-3 py-2 text-right">{r.year}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <RunningSection groups={groups} />
    </>
  );
}
