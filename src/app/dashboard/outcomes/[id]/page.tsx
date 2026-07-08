import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAssignmentDetail } from "@/features/performance/queries";
import { getCurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import { OPERATORS } from "@/features/auth/operators";
import { STEP_LABEL } from "@/features/performance/schemas";
import { OutcomeDetailEditor } from "./_DetailEditor";

/**
 * /dashboard/outcomes/[id] — 성과리포트 상세 작업 페이지 (admin 전용).
 * 개인목표 · 성과지표(80%) · 관리자지표(20%) 편집 + 발행. 3섹션.
 */
export default async function OutcomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentOperator();
  if (!me) redirect("/login");
  if (!canEditOperators(me.permission)) redirect("/dashboard/outcomes");

  const detail = await getAssignmentDetail(id);
  if (!detail) notFound();

  const evaluatee = OPERATORS.find(
    (o) => o.email === detail.assignment.evaluatee_email,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-7 py-6">
      <header className="flex items-baseline justify-between border-b border-line pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            {detail.cycle.name} · {detail.assignment.current_step}.{" "}
            {STEP_LABEL[detail.assignment.current_step]}
          </p>
          <h1 className="mt-1 text-xl font-bold text-ink">
            {evaluatee?.name ?? detail.assignment.evaluatee_email} 성과리포트
          </h1>
        </div>
        <Link
          href="/dashboard/outcomes"
          className="text-xs text-vermilion hover:underline"
        >
          ← 목록
        </Link>
      </header>

      <OutcomeDetailEditor
        assignmentId={detail.assignment.id}
        currentStep={detail.assignment.current_step}
        goals={detail.goals.map((g) => ({
          id: g.id,
          title: g.title,
          body: g.body ?? null,
        }))}
        metrics={detail.metrics.map((m) => ({
          id: m.id,
          name: m.name,
          weight: m.weight,
          achievement: m.achievement,
          sourceKey: m.source_key,
          quant: m.quant,
        }))}
        rubric={detail.rubric.map((r) => ({
          id: r.id,
          criterion: r.criterion,
          score: r.score,
          comment: r.comment,
        }))}
      />
    </div>
  );
}
