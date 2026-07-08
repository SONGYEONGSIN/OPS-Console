import { STEP_VALUES, STEP_LABEL, type Step } from "@/features/performance/schemas";
import { STEP_ACTOR } from "@/features/performance/permission";

const ACTOR_LABEL: Record<string, string> = {
  evaluator: "관리자",
  evaluatee: "팀원",
};

type Props = {
  currentStep: Step;
};

/**
 * 4단계 관리자 중심 워크플로우 시각 stepper.
 * - currentStep 미만 = 완료 (✓ + ink), 현재 = 활성 (vermilion), 초과 = 잠금 (muted)
 */
export function PerformanceStepper({ currentStep }: Props) {
  return (
    <ol
      data-testid="performance-stepper"
      className="grid grid-cols-4 gap-1 text-center"
    >
      {STEP_VALUES.map((step) => {
        const done = step < currentStep;
        const active = step === currentStep;
        const actor = STEP_ACTOR[step];
        const stateClass = done
          ? "border-ink bg-ink text-cream"
          : active
            ? "border-vermilion bg-vermilion text-cream"
            : "border-line-soft bg-washi text-ink-muted";
        return (
          <li key={step} className="flex flex-col items-center gap-1">
            <span
              data-state={done ? "done" : active ? "active" : "locked"}
              className={`inline-flex h-7 w-7 items-center justify-center border text-xs font-bold ${stateClass}`}
            >
              {done ? "✓" : step}
            </span>
            <span
              className={`text-[10px] leading-tight ${
                active ? "font-bold text-ink" : "text-ink-muted"
              }`}
            >
              {STEP_LABEL[step]}
            </span>
            <span className="text-[9px] text-muted">
              {actor ? ACTOR_LABEL[actor] : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
