import { redirect, notFound } from "next/navigation";
import { getAssignmentDetail } from "@/features/performance/queries";
import { getCurrentOperator } from "@/features/auth/queries";
import { OPERATORS } from "@/features/auth/operators";
import { STEP_LABEL } from "@/features/performance/schemas";
import {
  finalScore,
  scoreToGrade,
  performanceContribution,
  rubricContribution,
} from "@/features/performance/scoring";

/**
 * /dashboard/outcomes/[id]/print — 성과리포트 (HTML, 브라우저 Cmd+P).
 * 개인목표 · 성과지표(80%) · 관리자지표(20%) · 종합점수/등급. 라이브러리 없음.
 */
export default async function OutcomesPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentOperator();
  if (!me) redirect("/login");

  const detail = await getAssignmentDetail(id);
  if (!detail) notFound();

  const evaluator = OPERATORS.find(
    (o) => o.email === detail.assignment.evaluator_email,
  );
  const evaluatee = OPERATORS.find(
    (o) => o.email === detail.assignment.evaluatee_email,
  );

  const metricInputs = detail.metrics.map((m) => ({
    weight: m.weight,
    achievement: m.achievement ?? 0,
  }));
  const rubricScores = detail.rubric.map((r) => r.score);
  const perfPart = Math.round(performanceContribution(metricInputs) * 10) / 10;
  const rubricPart = Math.round(rubricContribution(rubricScores) * 10) / 10;
  const total = finalScore(metricInputs, rubricScores);
  const grade = scoreToGrade(total);

  return (
    <article className="space-y-6">
      <header className="border-b-2 border-ink pb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-vermilion">
          [운영부 상황실] 운영보고서
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-ink">
          {detail.cycle.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          관리자: {evaluator?.name ?? detail.assignment.evaluator_email} · 팀원:{" "}
          {evaluatee?.name ?? detail.assignment.evaluatee_email} · 상태:{" "}
          {detail.assignment.current_step}.{" "}
          {STEP_LABEL[detail.assignment.current_step]}
        </p>
      </header>

      {/* 개인목표 */}
      {detail.goals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            개인목표 ({detail.goals.length}건)
          </h2>
          <ol className="space-y-2 border border-line-soft bg-washi p-3">
            {detail.goals.map((g, i) => (
              <li
                key={g.id}
                className="border-b border-line-soft pb-2 last:border-b-0 last:pb-0"
              >
                <p className="font-bold text-ink">
                  {i + 1}. {g.title}
                </p>
                {g.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {g.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* 성과지표 80% */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
          성과지표 (80%) — 가중치 합 {metricInputs.reduce((s, m) => s + m.weight, 0)}
        </h2>
        {detail.metrics.length === 0 ? (
          <p className="text-sm text-muted">등록된 성과지표가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line-soft">
            {detail.metrics.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between p-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-muted">
                    가중치 {m.weight} · 달성률 {m.achievement ?? 0}%
                    {m.quant
                      ? ` · 정량 ${m.quant.value}${m.quant.unit}${m.quant.detail ? ` (${m.quant.detail})` : ""}`
                      : ""}
                    {m.before_value != null && m.after_value != null
                      ? ` · before ${m.before_value} → after ${m.after_value}`
                      : ""}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-sm font-bold tabular-nums text-ink">
                  {Math.round((m.weight * (m.achievement ?? 0)) / 100)}점
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-right text-xs text-ink-soft">
          성과 기여도 <span className="font-bold">{perfPart}</span> / 80
        </p>
      </section>

      {/* 관리자지표 20% */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
          관리자지표 (20%)
        </h2>
        {detail.rubric.length === 0 ? (
          <p className="text-sm text-muted">아직 채점되지 않았습니다.</p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line-soft">
            {detail.rubric.map((r) => (
              <li key={r.id} className="p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-ink">{r.criterion}</span>
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {r.score} / 5
                  </span>
                </div>
                {r.comment ? (
                  <p className="mt-1 text-xs text-ink-soft">{r.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="text-right text-xs text-ink-soft">
          관리자 기여도 <span className="font-bold">{rubricPart}</span> / 20
        </p>
      </section>

      {/* 종합점수 + 등급 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
          종합
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-ink bg-cream p-4 text-center">
            <p className="text-xs text-ink-muted">종합점수</p>
            <p className="my-2 text-4xl font-extrabold tabular-nums text-ink">
              {total}
            </p>
            <p className="text-[11px] text-ink-soft">성과 80 + 관리자 20</p>
          </div>
          <div className="border border-ink bg-cream p-4 text-center">
            <p className="text-xs text-ink-muted">등급</p>
            <p className="my-2 text-4xl font-extrabold text-vermilion-deep">
              {grade}
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-soft pt-3 text-[11px] text-muted">
        본 문서는 OPS-Console 자동 생성 — 인쇄: 브라우저 Cmd+P
      </footer>
    </article>
  );
}
