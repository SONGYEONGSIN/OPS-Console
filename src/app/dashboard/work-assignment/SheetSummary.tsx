import type { SheetSummaryRow } from "@/features/assignments/sheet-summary";
import type { WorkloadSummary } from "@/features/assignments/workload";

/**
 * 시트별 현황 — 담당 대학이 **어느 시트의 것인지** 말한다(사용자 요구 2026-09-22).
 *
 * 카드 하나로는 배정리스트 293곳과 성적산출 44곳이 한 덩어리로 보여, 어느 시트를
 * 손봐야 하는지 화면에서 읽을 수 없었다.
 *
 * **합계를 여기서 다시 세지 않는다.** 행을 더하면 467곳이 나와 카드(295곳)와 갈리는데,
 * 같은 화면의 두 숫자가 다른 값을 말하면 어느 쪽이 사실인지 볼 곳이 없다. 합계 줄은
 * 카드와 **같은 `summary` 객체**를 쓴다.
 */
export function SheetSummary({
  rows,
  summary,
}: {
  rows: readonly SheetSummaryRow[];
  summary: WorkloadSummary;
}) {
  return (
    <div className="mb-8">
      {/*
       * 제목은 표 위 제목 표준(`text-xl font-bold`)이다 — 작은 제목은 표를 끌어당겨
       * 같은 여백도 좁아 보인다. `이번 달 진행 상세` 와 같은 무게다.
       *
       * 열 이름은 **카드 이름 그대로**다(`담당 대학`·`서비스 물량`). 이 표는 그 카드
       * 둘을 시트별로 쪼갠 것이라, 다르게 부르면 같은 값인 줄 모른다. 화면에 같은
       * 말이 두 번 나오는 것은 의도이고, 표에 이름을 붙여 가른다.
       */}
      <h3 className="text-xl font-bold text-ink">시트별 현황</h3>
      <p className="mt-1 mb-3 text-xs text-muted">
        한 대학이 <b className="font-medium">여러 시트</b>에 걸쳐 있어 행을
        더하면 합계보다 큽니다 — 합계의 담당 대학은 중복을 뺀 수입니다.
      </p>
      <div className="overflow-x-auto border border-line-soft bg-paper">
        <table
          aria-label="시트별 현황"
          className="w-full text-left text-sm tabular-nums"
        >
          <thead>
            <tr className="border-b border-line-soft text-xs text-muted">
              <th scope="col" className="px-3 py-2 font-normal">
                시트
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                담당 대학
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                서비스 물량
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind} className="border-b border-line-soft">
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-medium text-ink"
                >
                  {r.sheet}
                </th>
                <td className="px-3 py-2 text-right">
                  {r.universities.toLocaleString("ko-KR")}
                  <span className="ml-1 text-xs text-muted">곳</span>
                </td>
                {/*
                 * **0 과 '못 셈' 을 같은 칸에 적지 않는다.** 성적산출 44곳은 마감에도
                 * 발표에도 없어서, 0 으로 적으면 그 44곳이 아무 일도 안 하는 것처럼
                 * 보인다.
                 */}
                <td className="px-3 py-2 text-right">
                  {r.services === null ? (
                    <span className="text-muted">— 원천 없음</span>
                  ) : (
                    <>
                      {r.services.toLocaleString("ko-KR")}
                      <span className="ml-1 text-xs text-muted">건</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-situation-bg">
              <th
                scope="row"
                className="px-3 py-2 text-left text-xs font-medium text-ink"
              >
                합계 (대학 중복 제거)
              </th>
              <td className="px-3 py-2 text-right font-medium text-ink">
                {summary.universities.toLocaleString("ko-KR")}
                <span className="ml-1 text-xs text-muted">곳</span>
              </td>
              <td className="px-3 py-2 text-right font-medium text-ink">
                {summary.services.toLocaleString("ko-KR")}
                <span className="ml-1 text-xs text-muted">건</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
