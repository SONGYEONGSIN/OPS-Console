import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import { listAssignmentsForUser } from "@/features/performance/queries";
import { createCycleWithAssignment } from "@/features/performance/actions";
import { OPERATORS } from "@/features/auth/operators";
import { AdminSummary } from "./_AdminSummary";
import type { Step } from "@/features/performance/schemas";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";

/**
 * /dashboard/outcomes — 성과리포트 (8단계 평가 워크플로우).
 * RLS가 본인 관련(evaluator/evaluatee) 또는 admin 자동 분기.
 */
export default async function OutcomesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const slug = "outcomes";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const { page } = await searchParams;

  const me = await getCurrentOperator();
  const isAdmin = canEditOperators(me?.permission ?? null);
  const assignments = await listAssignmentsForUser();
  const { rows, total } = paginateRows(
    assignments.map(assignmentToListRow),
    page,
  );
  const config = resolvePageMeta(slug, meta, total);

  // admin인 경우 페이지 상단에 4단계별 분포 요약 노출.
  const stepCounts: Record<Step, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const a of assignments) stepCounts[a.current_step] += 1;

  // 요약 분모 = 관리자가 평가할 팀원 총원 (본인 팀, 본인·테스트 제외).
  const teamSize = OPERATORS.filter(
    (o) =>
      !o.name.startsWith("테스트") &&
      o.email !== me?.email &&
      (!me?.team || o.team === me.team),
  ).length;

  // header 영역: PageHeader 다음에 admin 권한 시 AdminSummary 결합.
  // 표준 페이지 흐름(breadcrumb → headline → 본문)을 유지하기 위해 header prop에 묶어 전달.
  const header = (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      {isAdmin ? (
        <div className="px-7 pt-4">
          <AdminSummary stepCounts={stepCounts} teamSize={teamSize} />
        </div>
      ) : null}
    </>
  );

  // 신규(+ 새 사이클): 팀원 선택 + 사이클명 → cycle+assignment 생성 (관리자=본인).
  // 기존 assignment 편집(목표/지표/루브릭)은 상세 페이지에서 처리.
  const meEmail = me?.email ?? "";
  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (!isNew) return { ok: true };
    const r = await createCycleWithAssignment({
      cycleName: row.name ?? "",
      evaluateeEmail: row.performanceEvaluateeEmail ?? "",
      evaluatorEmail: meEmail,
    });
    return { ok: r.ok, error: r.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="performance"
      // admin만 + 새 사이클 가능. 팀원 select는 본인 팀으로 한정.
      canCreate={isAdmin}
      createLabel="+ 새 사이클"
      currentUserName={me?.displayName}
      currentUserTeam={me?.team ?? undefined}
      currentUserEmail={me?.email ?? undefined}
      onPersist={onPersist}
      footer={
        <ListPagination key="outcomes-pagination" total={total} pageSize={30} />
      }
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
