import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAssignmentDetail } from "@/features/performance/queries";
import { getCurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import { OPERATORS } from "@/features/auth/operators";
import { STEP_LABEL, type Step } from "@/features/performance/schemas";
import { PerformanceStepper } from "@/app/dashboard/_components/inspector/list-variants/performance/Stepper";
import { OutcomeDetailEditor } from "./_DetailEditor";

/** 단계별 관리자 다음 행동 안내. */
const STEP_GUIDE: Record<Step, string> = {
  1: "팀원의 개인목표를 등록하세요.",
  2: "성과지표와 가중치(합 80)를 등록한 뒤 ‘관리자 평가 단계로’를 누르세요.",
  3: "관리자지표 3항목을 채점한 뒤 ‘리포트 발행’을 누르세요.",
  4: "발행이 완료됐습니다. 리포트를 확인·인쇄할 수 있습니다.",
};

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

  const step = detail.assignment.current_step;

  return (
    <div className="min-h-full bg-white">
      <div className="mx-auto max-w-3xl space-y-6 px-7 py-6">
        <header className="flex items-baseline justify-between border-b border-line pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {detail.cycle.name} · {step}. {STEP_LABEL[step]}
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

        {/* 4단계 진행 표시 + 현재 단계 안내 */}
        <section className="space-y-2">
          <PerformanceStepper currentStep={step} />
          <p className="border border-line-soft bg-situation-bg px-3 py-2 text-xs text-ink-soft">
            <span className="font-bold text-ink">다음 할 일 · </span>
            {STEP_GUIDE[step]}
          </p>
        </section>

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
    </div>
  );
}
