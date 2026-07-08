import {
  STEP_LABEL,
  STEP_VALUES,
  type Step,
} from "@/features/performance/schemas";

type Props = {
  /** assignment row의 current_step 분포 */
  stepCounts: Record<Step, number>;
  /** 분모 — 관리자가 평가할 팀원 총원 (미시작 인원 포함). */
  teamSize: number;
};

/** 발행완료 단계 = 마지막 단계. */
const DONE_STEP = STEP_VALUES[STEP_VALUES.length - 1];

/**
 * admin 요약 — 단계별 분포를 운영보고서(KpiCard) 톤의 카드 4열로 표시.
 * - 분모는 평가 대상 팀원 총원(teamSize) — 아직 사이클 미생성 인원도 반영.
 * - 각 카드: 단계 번호 배지 + 라벨 + 큰 건수 / 팀원총원 + 비중(완료율)
 */
export function AdminSummary({ stepCounts, teamSize }: Props) {
  const completed = stepCounts[DONE_STEP] ?? 0;
  const completedPercent =
    teamSize === 0 ? 0 : Math.round((completed / teamSize) * 100);
  const steps: Step[] = [...STEP_VALUES];

  return (
    <section data-testid="performance-admin-summary" className="mb-6 space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-xl font-bold text-ink">관리자 요약</h3>
        <span className="text-xs text-ink-soft tabular-nums">
          전체 {teamSize}명 · 발행완료 {completed}명 ({completedPercent}%)
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {steps.map((step) => {
          const count = stepCounts[step] ?? 0;
          const has = count > 0;
          const done = step === DONE_STEP;
          return (
            <div
              key={step}
              data-step={step}
              data-count={count}
              className="flex flex-col gap-2 border border-line-soft bg-situation-bg p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center border text-[11px] font-bold ${
                    has
                      ? done
                        ? "border-ink bg-ink text-cream"
                        : "border-vermilion bg-vermilion text-cream"
                      : "border-line-soft bg-washi text-muted"
                  }`}
                >
                  {step}
                </span>
                <span className="text-xs font-medium text-muted">
                  {STEP_LABEL[step]}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    has ? "text-ink" : "text-muted"
                  }`}
                >
                  {count}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  / {teamSize}명
                </span>
              </div>
              <div className="text-2xs text-muted tabular-nums">
                {done ? "완료율" : "비중"}{" "}
                {teamSize === 0 ? 0 : Math.round((count / teamSize) * 1000) / 10}
                %
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
