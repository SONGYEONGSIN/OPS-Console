"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RUBRIC_CRITERIA,
  type Step,
  type RubricCriterion,
} from "@/features/performance/schemas";
import {
  AGGREGATOR_REGISTRY,
  AGGREGATOR_KEYS,
} from "@/features/performance/aggregators/registry";
import {
  finalScore,
  scoreToGrade,
  isValidMetricWeights,
} from "@/features/performance/scoring";
import {
  createGoal,
  createMetric,
  submitMetrics,
  upsertRubric,
  publishReport,
} from "@/features/performance/actions";

type Result = { ok: boolean; error?: string };
type QuantVal = { value: number; unit: string; detail?: string } | null;

type Goal = { id: string; title: string; body: string | null };
type Metric = {
  id: string;
  name: string;
  weight: number;
  achievement: number | null;
  sourceKey: string | null;
  quant: QuantVal;
};
type Rubric = {
  id: string;
  criterion: string;
  score: number;
  comment: string | null;
};

type Props = {
  assignmentId: string;
  currentStep: Step;
  goals: Goal[];
  metrics: Metric[];
  rubric: Rubric[];
};

export function OutcomeDetailEditor({
  assignmentId,
  currentStep,
  goals,
  metrics,
  rubric,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setError(r.error ?? "처리에 실패했습니다.");
      else router.refresh();
    });
  }

  const weightSum = metrics.reduce((s, m) => s + m.weight, 0);
  const weightsOk = isValidMetricWeights(metrics.map((m) => m.weight));
  const score = finalScore(
    metrics.map((m) => ({ weight: m.weight, achievement: m.achievement ?? 0 })),
    rubric.map((r) => r.score),
  );
  const grade = scoreToGrade(score);

  return (
    <div className="space-y-8">
      {error ? (
        <p className="border border-vermilion bg-washi px-3 py-2 text-xs text-vermilion">
          {error}
        </p>
      ) : null}

      {/* 1. 개인목표 */}
      <Section title="개인목표" badge={`${goals.length}건`}>
        {goals.length > 0 ? (
          <ul className="mb-3 divide-y divide-line-soft border border-line-soft">
            {goals.map((g, i) => (
              <li key={g.id} className="p-3">
                <p className="font-medium text-ink">
                  {i + 1}. {g.title}
                </p>
                {g.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                    {g.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-muted">등록된 목표가 없습니다.</p>
        )}
        <GoalAdd assignmentId={assignmentId} pending={pending} run={run} />
      </Section>

      {/* 2. 성과지표 80% */}
      <Section title="성과지표 (80%)" badge={`가중치 합 ${weightSum}/80`}>
        {metrics.length > 0 ? (
          <ul className="mb-3 divide-y divide-line-soft border border-line-soft">
            {metrics.map((m) => (
              <li
                key={m.id}
                className="flex items-baseline justify-between p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-muted">
                    가중치 {m.weight} · 달성률 {m.achievement ?? 0}%
                    {m.quant
                      ? ` · 정량 ${m.quant.value}${m.quant.unit}${m.quant.detail ? ` (${m.quant.detail})` : ""}`
                      : ""}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-sm font-bold tabular-nums text-ink">
                  {Math.round((m.weight * (m.achievement ?? 0)) / 100)}점
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-muted">등록된 성과지표가 없습니다.</p>
        )}
        <MetricAdd assignmentId={assignmentId} pending={pending} run={run} />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => submitMetrics(assignmentId))}
          className={`mt-3 w-full border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            weightsOk
              ? "border-line bg-ink text-cream hover:bg-ink/90"
              : "border-line-soft bg-washi text-muted"
          }`}
        >
          가중치 합 80 검증 + 관리자 평가 단계로{" "}
          {weightsOk ? "" : `(현재 ${weightSum})`}
        </button>
      </Section>

      {/* 3. 관리자지표 20% */}
      <Section title="관리자지표 (20%)" badge="1~5 척도">
        <div className="space-y-3">
          {RUBRIC_CRITERIA.map((c) => (
            <RubricRow
              key={c}
              criterion={c}
              assignmentId={assignmentId}
              existing={rubric.find((r) => r.criterion === c)}
              pending={pending}
              run={run}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => publishReport(assignmentId))}
          className="mt-3 w-full border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
        >
          3개 항목 확인 + 리포트 발행
        </button>
      </Section>

      {/* 종합 */}
      <Section title="종합" badge={currentStep === 4 ? "발행완료" : "미발행"}>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-ink bg-cream p-4 text-center">
            <p className="text-xs text-ink-muted">종합점수</p>
            <p className="my-1 text-3xl font-extrabold tabular-nums text-ink">
              {score}
            </p>
          </div>
          <div className="border border-ink bg-cream p-4 text-center">
            <p className="text-xs text-ink-muted">등급</p>
            <p className="my-1 text-3xl font-extrabold text-vermilion-deep">
              {grade}
            </p>
          </div>
        </div>
        <a
          href={`/dashboard/outcomes/${assignmentId}/print`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block border border-line bg-transparent px-3 py-1.5 text-center text-sm text-ink hover:bg-washi"
        >
          리포트(인쇄) 보기
        </a>
      </Section>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink">
          {title}
        </h2>
        {badge ? <span className="text-xs text-muted">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}

type AddProps = {
  assignmentId: string;
  pending: boolean;
  run: (action: () => Promise<Result>) => void;
};

function GoalAdd({ assignmentId, pending, run }: AddProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <form
      className="space-y-2 border border-line-soft bg-washi p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createGoal({ assignment_id: assignmentId, title, body }));
        setTitle("");
        setBody("");
      }}
    >
      <input
        aria-label="목표 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="목표 제목"
        className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
        required
      />
      <textarea
        aria-label="목표 세부"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="세부 내용 (선택)"
        rows={2}
        className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full border border-line bg-vermilion px-3 py-1 text-sm font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
      >
        목표 추가
      </button>
    </form>
  );
}

function MetricAdd({ assignmentId, pending, run }: AddProps) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [achievement, setAchievement] = useState("");
  return (
    <form
      className="space-y-2 border border-line-soft bg-washi p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          createMetric({
            assignment_id: assignmentId,
            name,
            weight: Number(weight),
            source_key: sourceKey || null,
            achievement: achievement === "" ? null : Number(achievement),
          }),
        );
        setName("");
        setWeight("");
        setSourceKey("");
        setAchievement("");
      }}
    >
      <input
        aria-label="지표명"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="지표명"
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
          placeholder="가중치"
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
          placeholder="달성률%"
          className="w-24 border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
        />
        <select
          aria-label="정량 소스"
          value={sourceKey}
          onChange={(e) => setSourceKey(e.target.value)}
          className="flex-1 border border-line bg-cream px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
        >
          <option value="">수동</option>
          {AGGREGATOR_KEYS.map((k) => (
            <option key={k} value={k}>
              {AGGREGATOR_REGISTRY[k].label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full border border-line bg-vermilion px-3 py-1 text-sm font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
      >
        지표 추가
      </button>
    </form>
  );
}

function RubricRow({
  criterion,
  assignmentId,
  existing,
  pending,
  run,
}: AddProps & { criterion: RubricCriterion; existing?: Rubric }) {
  const [score, setScore] = useState(existing ? String(existing.score) : "");
  const [comment, setComment] = useState(existing?.comment ?? "");
  return (
    <form
      className="space-y-2 border border-line-soft p-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          upsertRubric({
            assignment_id: assignmentId,
            criterion,
            score: Number(score),
            comment: comment || null,
          }),
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
        {existing ? "수정" : "저장"}
      </button>
    </form>
  );
}
