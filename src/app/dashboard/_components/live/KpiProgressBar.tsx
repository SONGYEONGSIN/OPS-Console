type Props = { done: number; total: number };

/** 가로 progress bar — done/total 분수 + width % 채움.
 *  width는 동적 값(0~100)이라 인라인 style 허용 (토큰화 불가). */
export function KpiProgressBar({ done, total }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex w-[100px] flex-col gap-1">
      <div className="text-right text-[10px] font-bold tabular-nums text-ink">
        {done} / {total}
      </div>
      <div className="h-1.5 w-full overflow-hidden border border-ink bg-line-soft">
        <div
          data-progress-fill
          className="h-full bg-ink transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
