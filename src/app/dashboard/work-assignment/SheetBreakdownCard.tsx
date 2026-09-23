import type { SheetSummaryRow } from "@/features/assignments/sheet-summary";

/**
 * 시트별 내역을 **카드 안에서** 나누는 카드(사용자 요구 2026-09-23).
 *
 * 모양은 운영리포트 `계약 체결`(`ContractSheetCard`) 그대로다 — 카드 제목 아래 세로
 * 구분선으로 칸을 나누고, 칸마다 작은 라벨 + 큰 숫자를 둔다. 사용자가 그 카드를
 * 가리키며 "이렇게" 라고 했고, 같은 일을 하는 자리는 같아 보여야 한다.
 *
 * **총계는 카드 머리가 든다.** 칸을 더하면 총계보다 큰데(담당 대학 467곳 ↔ 295곳),
 * 한 대학이 여러 시트에 걸려 있어서다. 카드 안에는 그 사실을 적을 자리가 없어,
 * 어긋나는 이유는 카드 묶음 아래 한 줄이 말한다.
 *
 * `KpiCard` 를 고치지 않은 이유: 그쪽은 운영리포트·전도금이 함께 쓰는 공용 카드라
 * 증감(▲/▼)이 본체다. 여기는 견줄 이전 기간이 아예 없어 늘 '비교 불가' 가 떠 있었고,
 * 그 자리에 다른 것을 넣는 것은 공용 카드의 약속을 바꾸는 일이다.
 */
export function SheetBreakdownCard({
  label,
  total,
  unit,
  rows,
  valueOf,
}: {
  label: string;
  total: number;
  unit: string;
  rows: readonly SheetSummaryRow[];
  /** 그 시트의 값. **`null` 은 0 이 아니라 '원천 없음'** 이다. */
  valueOf: (row: SheetSummaryRow) => number | null;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
    >
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {total.toLocaleString("ko-KR")}
        </span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      <div className="mt-2 flex gap-3 border-t border-line-soft pt-3">
        {rows.map((r, i) => {
          const value = valueOf(r);
          return (
            <div
              key={r.kind}
              data-sheet={r.sheet}
              className="flex min-w-0 flex-1 gap-3"
            >
              {i > 0 ? (
                <div className="w-px shrink-0 self-stretch bg-line-soft" />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="truncate text-2xs text-muted">{r.sheet}</div>
                {value === null ? (
                  /*
                   * **0 과 '못 셈' 을 같은 칸에 적지 않는다.** 성적산출 44곳은
                   * 마감에도 발표에도 없어서, 0 으로 적으면 그 44곳이 아무 일도
                   * 안 하는 것처럼 보인다.
                   */
                  <div className="text-2xs text-muted">원천 없음</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold tabular-nums text-ink">
                      {value.toLocaleString("ko-KR")}
                    </span>
                    <span className="text-2xs text-muted">{unit}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
