import {
  TENURE_GROUP_LABELS,
  careerYearsAt,
  type TenureGroup,
} from "@/features/assignments/tenure";
import type { WorkloadGroup } from "@/features/assignments/workload";

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

export function WorkloadTable({
  groups,
  now,
}: {
  groups: WorkloadGroup[];
  now: Date;
}) {
  if (groups.length === 0) {
    return (
      <div className="border border-dashed border-line-soft bg-situation-bg p-8 text-center">
        <p className="text-sm text-muted">배정 대상이 없습니다</p>
      </div>
    );
  }

  return (
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
  );
}
