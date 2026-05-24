import type { Step } from "@/features/performance/schemas";

const STEPS: { step: Step; label: string; actor: string }[] = [
  { step: 1, label: "목표설정", actor: "평가자" },
  { step: 2, label: "실행계획", actor: "팀원" },
  { step: 3, label: "계획검토", actor: "평가자" },
  { step: 4, label: "중간점검", actor: "팀원" },
  { step: 5, label: "점검검토", actor: "평가자" },
  { step: 6, label: "자기평가", actor: "팀원" },
  { step: 7, label: "종합평가", actor: "평가자" },
  { step: 8, label: "완료", actor: "—" },
];

type Props = {
  currentStep: Step;
};

/**
 * 8단계 평가 워크플로우 시각 stepper.
 * - currentStep 미만 = 완료 (✓ + ink 톤)
 * - currentStep = 활성 (vermilion 강조)
 * - currentStep 초과 = 잠금 (muted)
 */
export function PerformanceStepper({ currentStep }: Props) {
  return (
    <ol
      data-testid="performance-stepper"
      className="grid grid-cols-8 gap-1 text-center"
    >
      {STEPS.map(({ step, label, actor }) => {
        const done = step < currentStep;
        const active = step === currentStep;
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
              {label}
            </span>
            <span className="text-[9px] text-muted">{actor}</span>
          </li>
        );
      })}
    </ol>
  );
}
