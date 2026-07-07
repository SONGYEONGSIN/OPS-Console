import {
  STEP_LABEL,
  STEP_VALUES,
  type Step,
} from "@/features/performance/schemas";

type Props = {
  /** assignment row의 current_step 분포 */
  stepCounts: Record<Step, number>;
  total: number;
};

/** 발행완료 단계 = 마지막 단계. */
const DONE_STEP = STEP_VALUES[STEP_VALUES.length - 1];

/**
 * admin 요약 — 수평 진행 바 + 4 세그먼트 카운트 (Stepper 톤 일관).
 * - 가로 바: 단계×카운트 비율 시각화 (발행완료 = ink, 진행 = vermilion, 빈 = washi)
 * - 하단 grid: 각 step 라벨 + 카운트
 */
export function AdminSummary({ stepCounts, total }: Props) {
  const completed = stepCounts[DONE_STEP] ?? 0;
  const completedPercent =
    total === 0 ? 0 : Math.round((completed / total) * 100);
  const steps: Step[] = [...STEP_VALUES];

  return (
    <section
      data-testid="performance-admin-summary"
      className="mb-6 border border-line bg-cream p-3"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted">
          관리자 요약
        </h3>
        <span className="text-xs text-ink-soft tabular-nums">
          전체 {total}건 · 발행완료 {completed}건 ({completedPercent}%)
        </span>
      </header>

      {/* 세그먼트 가로 바 — 카운트 0=빈, >0=채움(발행완료=ink, 그 외=vermilion) */}
      <div className="mb-2 flex h-1.5 gap-0.5">
        {steps.map((step) => {
          const count = stepCounts[step] ?? 0;
          const tone =
            count === 0
              ? "bg-washi-raised"
              : step === DONE_STEP
                ? "bg-ink"
                : "bg-vermilion";
          return (
            <div
              key={step}
              className={`flex-1 ${tone}`}
              data-step={step}
              data-count={count}
            />
          );
        })}
      </div>

      {/* 세그먼트 라벨 + 카운트 */}
      <div className="grid grid-cols-4 gap-0.5 text-center">
        {steps.map((step) => {
          const count = stepCounts[step] ?? 0;
          return (
            <div key={step} className="flex flex-col leading-tight">
              <span className="text-[10px] text-ink-muted">
                {step}. {STEP_LABEL[step]}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  count > 0 ? "font-bold text-ink" : "text-muted"
                }`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
