"use client";

import { useState, useTransition } from "react";
import type { EditFormProps } from "../types";
import {
  STEP_LABEL,
  RUBRIC_CRITERIA,
  type Step,
} from "@/features/performance/schemas";
import {
  AGGREGATOR_REGISTRY,
  AGGREGATOR_KEYS,
} from "@/features/performance/aggregators/registry";
import {
  createGoal,
  createMetric,
  submitMetrics,
  upsertRubric,
  publishReport,
} from "@/features/performance/actions";
import { PerformanceStepper } from "./Stepper";

type Result = { ok: boolean; error?: string };

/**
 * performance EditForm — 관리자 전용 페이지에서 단계별 실제 액션 구동.
 * step1 개인목표 / step2 성과지표(가중치) / step3 관리자 루브릭 / step4 발행완료.
 */
export function PerformanceEditForm({ row, onCancel }: EditFormProps) {
  const step = (row.performanceCurrentStep ?? 1) as Step;
  const assignmentId = row.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<Result>, closeOnOk = true) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setError(r.error ?? "처리에 실패했습니다.");
      else if (closeOnOk) onCancel();
    });
  }

  return (
    <div className="space-y-4">
      <PerformanceStepper currentStep={step} />
      {error ? (
        <p className="border border-vermilion bg-washi px-3 py-2 text-xs text-vermilion">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <GoalForm assignmentId={assignmentId} pending={pending} run={run} />
      ) : step === 2 ? (
        <MetricForm assignmentId={assignmentId} pending={pending} run={run} />
      ) : step === 3 ? (
        <RubricForm assignmentId={assignmentId} pending={pending} run={run} />
      ) : (
        <div className="border border-line-soft bg-washi p-3 text-xs text-muted">
          발행 완료된 리포트입니다. 상세는 리포트 페이지에서 확인하세요.
        </div>
      )}

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

type StepFormProps = {
  assignmentId: string;
  pending: boolean;
  run: (action: () => Promise<Result>, closeOnOk?: boolean) => void;
};

/** step 1 — 개인목표 추가. */
function GoalForm({ assignmentId, pending, run }: StepFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createGoal({ assignment_id: assignmentId, title, body }));
      }}
    >
      <p className="text-xs font-medium text-muted">
        1. {STEP_LABEL[1]} — 개인목표를 추가합니다.
      </p>
      <input
        aria-label="목표 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="목표 제목 (예: 원서접수 및 PIMS 서비스 안정적 운영)"
        className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
        required
      />
      <textarea
        aria-label="목표 세부"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="세부 내용 (선택)"
        rows={3}
        className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
      />
      <SubmitButton pending={pending} label="목표 추가" />
    </form>
  );
}

/** step 2 — 성과지표 추가 + 가중치 합 80 제출. */
function MetricForm({ assignmentId, pending, run }: StepFormProps) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [achievement, setAchievement] = useState("");
  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createMetric({
                assignment_id: assignmentId,
                name,
                weight: Number(weight),
                source_key: sourceKey || null,
                achievement: achievement === "" ? null : Number(achievement),
              }),
            false,
          );
          setName("");
          setWeight("");
          setSourceKey("");
          setAchievement("");
        }}
      >
        <p className="text-xs font-medium text-muted">
          2. {STEP_LABEL[2]} — 성과지표를 추가합니다 (가중치 합 = 80).
        </p>
        <input
          aria-label="지표명"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="지표명 (예: 반복 수동업무 자동화 20% 단축)"
          className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
          required
        />
        <div className="flex gap-2">
          <input
            aria-label="가중치"
            type="number"
            min={0}
            max={80}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="가중치(점)"
            className="w-24 border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
            required
          />
          <input
            aria-label="달성률"
            type="number"
            min={0}
            max={100}
            value={achievement}
            onChange={(e) => setAchievement(e.target.value)}
            placeholder="달성률(%)"
            className="w-24 border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
          />
        </div>
        <select
          aria-label="정량 소스"
          value={sourceKey}
          onChange={(e) => setSourceKey(e.target.value)}
          className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
        >
          <option value="">정량 소스 없음 (수동)</option>
          {AGGREGATOR_KEYS.map((k) => (
            <option key={k} value={k}>
              {AGGREGATOR_REGISTRY[k].label}
            </option>
          ))}
        </select>
        <SubmitButton pending={pending} label="지표 추가" />
      </form>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => submitMetrics(assignmentId))}
        className="w-full border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
      >
        가중치 합 80 검증 + 관리자 평가 단계로
      </button>
    </div>
  );
}

/** step 3 — 관리자 루브릭 3항목 채점 + 발행. */
function RubricForm({ assignmentId, pending, run }: StepFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted">
        3. {STEP_LABEL[3]} — 관리자지표(20%)를 채점합니다 (1~5).
      </p>
      {RUBRIC_CRITERIA.map((criterion) => (
        <CriterionRow
          key={criterion}
          criterion={criterion}
          assignmentId={assignmentId}
          pending={pending}
          run={run}
        />
      ))}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => publishReport(assignmentId))}
        className="w-full border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
      >
        3개 항목 확인 + 리포트 발행
      </button>
    </div>
  );
}

function CriterionRow({
  criterion,
  assignmentId,
  pending,
  run,
}: StepFormProps & { criterion: (typeof RUBRIC_CRITERIA)[number] }) {
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  return (
    <form
      className="space-y-2 border border-line-soft p-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            upsertRubric({
              assignment_id: assignmentId,
              criterion,
              score: Number(score),
              comment: comment || null,
            }),
          false,
        );
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-medium text-ink">{criterion}</span>
        <select
          aria-label={`${criterion} 점수`}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-16 border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
          required
        >
          <option value="">-</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <textarea
        aria-label={`${criterion} 근거`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="근거 코멘트"
        rows={2}
        className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink focus:border-ink focus:bg-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full border border-line bg-transparent px-2 py-1 text-xs text-ink hover:bg-washi disabled:opacity-50"
      >
        {criterion} 저장
      </button>
    </form>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
    >
      {pending ? "처리 중…" : label}
    </button>
  );
}
