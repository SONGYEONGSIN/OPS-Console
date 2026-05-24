"use client";

import { useState } from "react";
import type { EditFormProps } from "../types";
import {
  GRADE_VALUES,
  GRADE_DESCRIPTION_PERFORMANCE,
  GRADE_DESCRIPTION_COMPETENCY,
  type Grade,
  type Step,
} from "@/features/performance/schemas";
import { canAct, STEP_ACTOR } from "@/features/performance/permission";
import { PerformanceStepper } from "./Stepper";

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

/**
 * performance EditForm — 현재 단계의 actor가 본인일 때만 입력 활성.
 * 권한 없으면 잠금 메시지 + 읽기 모드.
 *
 * 1차 PR skeleton — 실제 server action 호출은 다음 PR.
 * 본 폼은 step별 단순 textarea + (step=7) grade 2 select.
 */
export function PerformanceEditForm({ row, onSave, onCancel }: EditFormProps) {
  const step = (row.performanceCurrentStep ?? 1) as Step;
  const actor = STEP_ACTOR[step];

  // currentUserRole은 row.performance* email 기반 — page에서 currentUserEmail
  // 전달이 필요하나 1차는 placeholder로 evaluator 기본. (Phase D에서 wiring)
  const currentUserRole = actor ?? "evaluator";
  const canEdit = actor !== null && canAct(step, currentUserRole);

  const [body, setBody] = useState("");
  const [gradePerformance, setGradePerformance] = useState<Grade | "">("");
  const [gradeCompetency, setGradeCompetency] = useState<Grade | "">("");

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <PerformanceStepper currentStep={step} />
        <div className="border border-line-soft bg-washi p-3 text-xs text-muted">
          현재 단계({step}. {STEP_LABEL[step]})는{" "}
          <span className="font-bold text-ink">
            {actor === "evaluator" ? "평가자" : actor === "evaluatee" ? "팀원" : "—"}
          </span>
          의 차례입니다. 본인 차례에 다시 시도해주세요.
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          닫기
        </button>
      </div>
    );
  }

  const showGradeSelects = step === 7;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <PerformanceStepper currentStep={step} />

      <label className="block text-xs">
        <span className="mb-1 block text-muted">
          {step}. {STEP_LABEL[step]} 내용
        </span>
        <textarea
          aria-label={`${STEP_LABEL[step]} 내용`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder={`${STEP_LABEL[step]} 내용을 작성해주세요`}
        />
      </label>

      {showGradeSelects ? (
        <>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              성과평가 등급 (80%)
            </span>
            <select
              aria-label="성과평가 등급"
              value={gradePerformance}
              onChange={(e) => setGradePerformance(e.target.value as Grade | "")}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
              title={
                gradePerformance
                  ? GRADE_DESCRIPTION_PERFORMANCE[gradePerformance]
                  : ""
              }
            >
              <option value="">선택…</option>
              {GRADE_VALUES.map((g) => (
                <option
                  key={g}
                  value={g}
                  title={GRADE_DESCRIPTION_PERFORMANCE[g]}
                >
                  {g} — {GRADE_DESCRIPTION_PERFORMANCE[g]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              역량평가 등급 (20%)
            </span>
            <select
              aria-label="역량평가 등급"
              value={gradeCompetency}
              onChange={(e) => setGradeCompetency(e.target.value as Grade | "")}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
              title={
                gradeCompetency
                  ? GRADE_DESCRIPTION_COMPETENCY[gradeCompetency]
                  : ""
              }
            >
              <option value="">선택…</option>
              {GRADE_VALUES.map((g) => (
                <option
                  key={g}
                  value={g}
                  title={GRADE_DESCRIPTION_COMPETENCY[g]}
                >
                  {g} — {GRADE_DESCRIPTION_COMPETENCY[g]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장 + 다음 단계로
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}
