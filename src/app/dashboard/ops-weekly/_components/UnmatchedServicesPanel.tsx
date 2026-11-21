import type { UnmatchedServices } from "@/features/ops-weekly/auto-lists/unmatched";
import { formatPeriod, formatYmd } from "../_format";

const TH = "px-3 py-2";
const TD = "px-3 py-2";
const EMPTY_NAME = "(비어 있음)";

function Group(props: {
  title: string;
  tableLabel: string;
  heads: readonly string[];
  rows: readonly { key: number; cells: readonly string[] }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-ink">{`${props.title} ${props.rows.length}건`}</h3>
      {props.rows.length === 0 ? (
        <p className="text-sm text-muted">지정 안된 서비스가 없습니다</p>
      ) : (
        // 일회성: 4열이 좁은 화면에서 찌그러지지 않는 최소 폭(제출 표와 같다)
        <div className="overflow-x-auto">
          <table
            aria-label={props.tableLabel}
            className="w-full min-w-[34rem] text-sm"
          >
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                {props.heads.map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-line-soft text-ink hover:bg-line-soft"
                >
                  {r.cells.map((c, i) => (
                    <td
                      key={i}
                      className={`${TD} min-w-0 break-words ${i === r.cells.length - 1 ? "tabular-nums" : ""}`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const nameOf = (n: string | null) =>
  n === null || n.trim() === "" ? EMPTY_NAME : n;

/**
 * 안 붙은 서비스 — 담당자 이름이 작성 대상 누구와도 맞지 않아 어느 보고서에도 안 들어간 것.
 * 원서접수·발표 탭 머리의 숫자가 가리키는 바로 그 목록이다(개수 = 목록 길이, 같은 판정 함수).
 */
export function UnmatchedServicesPanel({
  unmatched,
}: {
  /** null = 목록을 읽지 않았다 — 0건('없다')과 갈라 적는다 */
  unmatched: UnmatchedServices | null;
}) {
  return (
    <section
      id="unmatched"
      aria-label="지정 안된 서비스"
      // 일회성 임의 값: 고정 KPI 바(--ops-kpi-h) 아래에 서도록. 바가 없는 lg 미만은 scroll-mt-4.
      className="flex scroll-mt-4 flex-col gap-3 lg:scroll-mt-[calc(var(--ops-kpi-h,12rem)_+_0.5rem)]"
    >
      <h2 className="text-xl font-bold text-ink">지정 안된 서비스</h2>
      <p className="text-xs text-muted">
        이 주 서비스 중 담당자 이름이 작성 대상 누구와도 맞지 않아 어느
        보고서에도 안 들어간 것입니다 — 서비스마감 메뉴에서 담당자 이름을
        고치세요. 보고서 탭의 숫자는 굳은 값일 수 있어 이 목록(현재 기준)과 다를
        수 있습니다.
      </p>
      {unmatched === null ? (
        <p className="text-sm text-muted">목록을 불러오지 않았습니다</p>
      ) : (
        <>
      <Group
        title="원서접수"
        tableLabel="원서접수 지정 안된 서비스"
        heads={["대학", "서비스명", "서비스마감 담당자", "접수기간"]}
        rows={unmatched.application.map((r) => ({
          key: r.service_id,
          cells: [
            r.university_name,
            r.service_name,
            nameOf(r.operator_name),
            formatPeriod(r.write_start_at, r.write_end_at),
          ],
        }))}
      />
      <Group
        title="합격자 발표"
        tableLabel="합격자 발표 지정 안된 서비스"
        heads={["대학", "서비스명", "담당자", "발표일"]}
        rows={unmatched.pims.map((r) => ({
          key: r.service_id,
          cells: [
            r.university_name,
            r.service_name,
            nameOf(r.operator_name),
            formatYmd(r.last_announce_at),
          ],
        }))}
      />
        </>
      )}
    </section>
  );
}
