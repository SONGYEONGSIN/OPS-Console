import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";
import { PerformanceStepper } from "./Stepper";
import { STEP_LABEL, type Step } from "@/features/performance/schemas";

/**
 * performance 인스펙터 읽기 View — 단계 stepper + 기본 메타 + 리포트 링크.
 * 상세 3섹션(개인목표 / 성과지표 80% / 관리자 20% / 종합점수)은 리포트 페이지에서 렌더.
 */
export function PerformanceView({ row }: ViewProps) {
  const step = (row.performanceCurrentStep ?? 1) as Step;
  const published = step === 4;

  return (
    <div className="space-y-6">
      <Section title="진행 단계">
        <PerformanceStepper currentStep={step} />
      </Section>

      <Divider />

      <Section title="기본">
        <DefList
          items={[
            {
              term: "사이클",
              desc: row.performanceCycleName ?? row.name ?? "-",
            },
            { term: "관리자", desc: row.performanceEvaluatorName ?? "-" },
            { term: "팀원", desc: row.performanceEvaluateeName ?? "-" },
            {
              term: "현재 단계",
              desc: (
                <span className="inline-block border border-vermilion bg-vermilion px-2 py-0.5 text-xs text-cream">
                  {STEP_LABEL[step]}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="리포트">
        <a
          href={`/dashboard/outcomes/${row.id}/print`}
          target="_blank"
          rel="noreferrer"
          className="inline-block border border-ink bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink/90"
        >
          {published ? "발행된 리포트 보기" : "리포트 미리보기"}
        </a>
        <p className="mt-2 text-xs text-muted">
          개인목표 · 성과지표(80%) · 관리자지표(20%) · 종합점수를 확인합니다.
        </p>
      </Section>
    </div>
  );
}
