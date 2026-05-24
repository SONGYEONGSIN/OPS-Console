import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";
import { PerformanceStepper } from "./Stepper";
import {
  GRADE_DESCRIPTION_PERFORMANCE,
  GRADE_DESCRIPTION_COMPETENCY,
  type Grade,
  type Step,
} from "@/features/performance/schemas";

const STEP_LABEL: Record<Step, string> = {
  1: "목표설정",
  2: "실행계획",
  3: "계획검토",
  4: "중간점검",
  5: "점검검토",
  6: "자기평가",
  7: "종합평가",
  8: "완료",
};

const GRADE_COLOR: Record<Grade, string> = {
  S: "bg-vermilion-deep text-cream",
  A: "bg-vermilion text-cream",
  B: "bg-gold text-cream",
  C: "bg-line-soft text-ink",
  D: "bg-washi-raised text-muted",
};

/**
 * performance 인스펙터 읽기 View — 상단 stepper + 기본 메타.
 * 단계별 본문(목표/계획/검토/평가 리스트)은 follow-up — 1차는 skeleton.
 */
export function PerformanceView({ row }: ViewProps) {
  const step = (row.performanceCurrentStep ?? 1) as Step;

  // grade 정보가 row에 미수신 — 1차는 skeleton. row.gradePerformance/gradeCompetency는 follow-up
  const gradePerformance: Grade | undefined = undefined;
  const gradeCompetency: Grade | undefined = undefined;

  return (
    <div className="space-y-6">
      <Section title="진행 단계">
        <PerformanceStepper currentStep={step} />
      </Section>

      <Divider />

      <Section title="기본">
        <DefList
          items={[
            { term: "사이클", desc: row.performanceCycleName ?? row.name ?? "-" },
            { term: "평가자", desc: row.performanceEvaluatorName ?? "-" },
            { term: "팀원", desc: row.performanceEvaluateeName ?? "-" },
            {
              term: "현재 단계",
              desc: (
                <span className="inline-block border border-ink bg-cream px-2 py-0.5 text-xs text-ink">
                  {step}. {STEP_LABEL[step]}
                </span>
              ),
            },
          ]}
        />
      </Section>

      {step === 8 && (gradePerformance || gradeCompetency) ? (
        <>
          <Divider />
          <Section title="평가 결과">
            <DefList
              items={[
                {
                  term: "성과평가",
                  desc: gradePerformance ? (
                    <span
                      title={GRADE_DESCRIPTION_PERFORMANCE[gradePerformance]}
                      className={`inline-block px-2 py-0.5 text-xs font-bold ${GRADE_COLOR[gradePerformance]}`}
                    >
                      {gradePerformance}
                    </span>
                  ) : (
                    "-"
                  ),
                },
                {
                  term: "역량평가",
                  desc: gradeCompetency ? (
                    <span
                      title={GRADE_DESCRIPTION_COMPETENCY[gradeCompetency]}
                      className={`inline-block px-2 py-0.5 text-xs font-bold ${GRADE_COLOR[gradeCompetency]}`}
                    >
                      {gradeCompetency}
                    </span>
                  ) : (
                    "-"
                  ),
                },
              ]}
            />
          </Section>
        </>
      ) : null}
    </div>
  );
}
