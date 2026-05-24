import { redirect, notFound } from "next/navigation";
import { getAssignmentDetail } from "@/features/performance/queries";
import { getCurrentOperator } from "@/features/auth/queries";
import { OPERATORS } from "@/features/auth/operators";
import {
  GRADE_DESCRIPTION_PERFORMANCE,
  GRADE_DESCRIPTION_COMPETENCY,
  type Step,
  type Grade,
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

/**
 * /dashboard/outcomes/[id]/print — 운영자별 평가 결과 인쇄 (HTML, 브라우저 Cmd+P).
 * 라이브러리 없음, chrome/사이드바 미렌더.
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

  const finalReview = detail.reviews.find((r) => r.step === 7);
  const gradePerformance = finalReview?.grade_performance as Grade | undefined;
  const gradeCompetency = finalReview?.grade_competency as Grade | undefined;

  return (
    <article className="space-y-6">
      <header className="border-b-2 border-ink pb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-vermilion">
          [운영부 상황실] 성과리포트
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-ink">
          {detail.cycle.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          평가자: {evaluator?.name ?? detail.assignment.evaluator_email} · 팀원:{" "}
          {evaluatee?.name ?? detail.assignment.evaluatee_email}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
          진행 상태
        </h2>
        <p className="text-base text-ink">
          {detail.assignment.current_step}.{" "}
          {STEP_LABEL[detail.assignment.current_step]}
        </p>
      </section>

      {detail.goals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            목표 ({detail.goals.length}건)
          </h2>
          <ol className="space-y-2 border border-line-soft bg-washi p-3">
            {detail.goals.map((g, i) => (
              <li key={g.id} className="border-b border-line-soft pb-2 last:border-b-0 last:pb-0">
                <p className="font-bold text-ink">
                  {i + 1}. {g.title} ({Math.round(g.weight * 100)}%)
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

      {detail.reviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            검토 / 평가 이력
          </h2>
          <ol className="space-y-3">
            {detail.reviews.map((r) => (
              <li key={r.id} className="border border-line-soft bg-washi p-3">
                <p className="text-xs text-ink-muted">
                  {r.step}. {STEP_LABEL[r.step as Step]} · {r.role === "evaluator" ? "평가자" : "팀원"}
                </p>
                {r.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {r.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {finalReview && (gradePerformance || gradeCompetency) ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            최종 등급
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-ink bg-cream p-4 text-center">
              <p className="text-xs text-ink-muted">성과평가 (80%)</p>
              <p className="my-2 text-4xl font-extrabold text-vermilion-deep">
                {gradePerformance ?? "-"}
              </p>
              {gradePerformance ? (
                <p className="text-[11px] leading-tight text-ink-soft">
                  {GRADE_DESCRIPTION_PERFORMANCE[gradePerformance]}
                </p>
              ) : null}
            </div>
            <div className="border border-ink bg-cream p-4 text-center">
              <p className="text-xs text-ink-muted">역량평가 (20%)</p>
              <p className="my-2 text-4xl font-extrabold text-gold">
                {gradeCompetency ?? "-"}
              </p>
              {gradeCompetency ? (
                <p className="text-[11px] leading-tight text-ink-soft">
                  {GRADE_DESCRIPTION_COMPETENCY[gradeCompetency]}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-line-soft pt-3 text-[11px] text-muted">
        본 문서는 OPS-Console 자동 생성 — 인쇄: 브라우저 Cmd+P
      </footer>
    </article>
  );
}
