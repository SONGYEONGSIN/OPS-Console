import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import { listAssignmentsForUser } from "@/features/performance/queries";
import { OPERATORS } from "@/features/auth/operators";

/**
 * /dashboard/outcomes — 성과리포트 (8단계 평가 워크플로우).
 * RLS가 본인 관련(evaluator/evaluatee) 또는 admin 자동 분기.
 */
export default async function OutcomesPage() {
  const slug = "outcomes";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const isAdmin = canEditOperators(me?.permission ?? null);
  const assignments = await listAssignmentsForUser();
  const rows: ListRow[] = assignments.map(assignmentToListRow);
  const config = resolvePageMeta(slug, meta, rows.length);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  // 1차 PR — onPersist는 placeholder (각 단계 server action은 EditForm에서 직접 호출 예정)
  async function onPersist(): Promise<{ ok: boolean; error?: string }> {
    "use server";
    return { ok: true };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="performance"
      // admin만 + 새 사이클 가능 (실제 사이클/매핑 생성은 follow-up)
      canCreate={isAdmin}
      createLabel="+ 새 사이클"
      currentUserName={me?.displayName}
      onPersist={onPersist}
    />
  );
}

type AssignmentRow = Awaited<ReturnType<typeof listAssignmentsForUser>>[number];

function assignmentToListRow(a: AssignmentRow): ListRow {
  const evaluator = OPERATORS.find((o) => o.email === a.evaluator_email);
  const evaluatee = OPERATORS.find((o) => o.email === a.evaluatee_email);
  return {
    id: a.id,
    name: a.cycle_name,
    status: a.cycle_status === "open" ? "active" : "approved",
    owner: evaluatee?.name ?? a.evaluatee_email,
    performanceCycleName: a.cycle_name,
    performanceCurrentStep: a.current_step,
    performanceEvaluatorName: evaluator?.name ?? a.evaluator_email,
    performanceEvaluateeName: evaluatee?.name ?? a.evaluatee_email,
    performanceEvaluatorEmail: a.evaluator_email,
    performanceEvaluateeEmail: a.evaluatee_email,
  };
}
