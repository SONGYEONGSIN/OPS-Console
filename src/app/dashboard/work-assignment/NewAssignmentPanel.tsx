import {
  TENURE_GROUP_LABELS,
  type TenureGroup,
} from "@/features/assignments/tenure";
import type { NewcomerRow } from "@/features/assignments/newcomers";
import type { WorkloadGroup } from "@/features/assignments/workload";
import { RequestAssignment } from "./RequestAssignment";

/**
 * 신규배정 — **3월 배정 이후에 들어온 서비스만 건건히 배정하는 자리**(사용자).
 *
 * 흐름이 모니터링이라 이 탭은 **대개 비어 있어야 맞다.** 그래서 빈 화면이 가장
 * 중요한 화면이고, 비었을 때 왜 비었는지를 적는다 — 0 은 '없다' 와 '못 읽었다' 가
 * 구분이 안 된다.
 *
 * 한 줄이 네 물음에 답한다. ①어느 시트에(`sheet`) ②언제 시작(`start`) ③어느
 * 그룹에 ④그 그룹이 **그때** 여유가 있나. ③④는 펼침 안에 있고, 부하는 서비스
 * 시작일로 창을 옮겨 다시 잰 값이다 — '지금 여유 있나' 를 보면 12월 서비스를 9월
 * 부하로 판단하게 된다.
 *
 * 서버 컴포넌트다. 데이터는 페이지가 한 번 읽어 넘긴다.
 */

/** 줄 + 그 서비스 시작 시점의 배분현황. 시작을 모르면 잴 수 없어 `null` 이다. */
export type NewcomerView = NewcomerRow & {
  loadAtStart: WorkloadGroup[] | null;
};

const COLUMNS = ["대학", "업무종류", "시트", "시작", "서비스", ""] as const;

const SOURCE_NOTE: Record<NewcomerRow["source"], string> = {
  "ledger-unassigned": "원장에 칸은 있는데 비어 있습니다",
  "ledger-unlinked":
    "이름은 있고 주소가 없습니다 — 명부에서 이름을 맞춰 주세요",
  "not-in-ledger": "배정 시트에 아직 없는 서비스입니다",
};

/** `2026-10-01` → `10.01`. 같은 해 안에서 보는 표라 연도는 접는다. */
const shortDay = (day: string) => day.slice(5).replace("-", ".");

/** `toFixed` 만 쓰면 5.35 가 5.3 으로 내려간다(부동소수). 먼저 반올림한다. */
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

const groupLabel = (group: string) =>
  TENURE_GROUP_LABELS[group as TenureGroup] ?? group;

/**
 * ③④ — 그 서비스가 시작하는 주·달에 누가 얼마나 들고 있는가.
 *
 * 고르지 않는다. 그룹 목표와 그때 부하를 나란히 놓을 뿐이고, 배정은 `[배정 요청]`
 * 이 만든 제안을 관리자가 승인해 정해진다.
 */
function LoadAtStart({
  start,
  groups,
}: {
  start: string | null;
  groups: WorkloadGroup[] | null;
}) {
  if (start === null || groups === null) {
    return (
      <p className="mt-2 text-xs text-muted">
        시작을 몰라 그때 여유를 잴 수 없습니다 — 원천에 접수기간이 없습니다.
      </p>
    );
  }
  return (
    <div className="mt-2">
      <p className="text-xs text-muted">
        {start} 기준 — 그 주·그 달에 각자 몇 건을 들고 있는지입니다.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <thead>
            <tr className="border-b border-line-soft text-muted">
              <th scope="col" className="px-2 py-1 font-normal">
                이름
              </th>
              <th scope="col" className="px-2 py-1 font-normal">
                그룹
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                대학 수
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                밀도
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                그 주
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                그 달
              </th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.group}>
              <tr className="border-b border-line-soft bg-situation-bg">
                <th
                  scope="colgroup"
                  colSpan={6}
                  className="px-2 py-1 text-left font-medium text-ink"
                >
                  {g.target
                    ? `${groupLabel(g.group)} · 목표 ${oneDecimal(g.target.universities)}곳 · 밀도 ${oneDecimal(g.target.density)}`
                    : `${groupLabel(g.group)} · 목표 없음`}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr
                  key={r.email}
                  className="border-b border-line-soft last:border-0"
                >
                  <td className="px-2 py-1 text-ink">{r.name}</td>
                  <td className="px-2 py-1 text-muted">
                    {groupLabel(g.group)}
                  </td>
                  <td className="px-2 py-1 text-right">{r.universities}</td>
                  <td className="px-2 py-1 text-right">
                    {oneDecimal(r.density)}
                  </td>
                  <td className="px-2 py-1 text-right">{r.week}</td>
                  <td className="px-2 py-1 text-right">{r.month}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export function NewAssignmentPanel({
  rows,
  academicYear,
}: {
  rows: NewcomerView[];
  academicYear: number;
}) {
  if (rows.length === 0) {
    return (
      <>
        <header className="mb-4">
          <h2 className="text-sm font-medium text-ink">신규배정</h2>
          <p className="mt-1 text-xs text-muted">
            3월 배정 이후에 들어온 서비스만 여기 섭니다.
          </p>
        </header>
        <div className="border border-dashed border-line-soft bg-situation-bg p-8 text-center">
          <p className="text-sm text-muted">
            주인 없는 서비스가 없습니다 — 원장의 빈 칸도, 시트에 없는 접수 예정
            서비스도 없습니다.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="mb-4">
        <h2 className="text-sm font-medium text-ink">
          신규배정 <span className="tabular-nums">{rows.length}곳</span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          시작이 이른 것부터입니다. 펼치면 그 서비스가 시작하는 주·달에 각
          그룹이 얼마나 들고 있는지 보입니다.
          <br />
          접수가 **이미 시작한** 시트 밖 서비스는 담지 않습니다 — 대부분 대학명
          표기가 갈린 것이라, 배정이 아니라 이름을 맞출 일입니다.
        </p>
      </header>
      <div className="overflow-x-auto border border-line-soft bg-paper">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-soft text-xs text-muted">
              {COLUMNS.map((c, i) => (
                <th
                  key={c || `act-${i}`}
                  scope="col"
                  className="px-3 py-2 font-normal"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.university_name}|${r.work_kind}`}
                className="border-b border-line-soft align-top last:border-0"
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {r.university_name}
                  <span className="mt-1 block text-xs font-normal text-muted">
                    {SOURCE_NOTE[r.source]}
                    {r.assigneeName ? ` (${r.assigneeName})` : ""}
                  </span>
                  {/* 표기 갈림인지 진짜 새 대학인지를 **줄에서** 가른다. 잇지는 않는다. */}
                  {r.similarNames && r.similarNames.length > 0 && (
                    <span className="mt-1 block text-xs font-normal text-vermilion">
                      원장에 비슷한 이름이 있습니다 —{" "}
                      {r.similarNames.join(" · ")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{r.work_kind}</td>
                <td className="px-3 py-2 text-muted">{r.sheet ?? "—"}</td>
                <td className="px-3 py-2 text-muted tabular-nums">
                  {r.start === null ? "모름" : shortDay(r.start)}
                </td>
                <td className="px-3 py-2 text-muted">
                  {r.services.length === 0 ? "—" : r.services.join(", ")}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-ink">
                      그때 여유 보기
                    </summary>
                    <LoadAtStart start={r.start} groups={r.loadAtStart} />
                  </details>
                </td>
                <td className="px-3 py-2">
                  {r.canRequest && (
                    <RequestAssignment
                      academicYear={academicYear}
                      universityName={r.university_name}
                      workKind={r.work_kind}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
