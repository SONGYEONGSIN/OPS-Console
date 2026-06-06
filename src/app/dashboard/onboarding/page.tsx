import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { GuidePattern } from "../_components/patterns/GuidePattern";
import type { GuideTab } from "../_components/patterns/GuidePattern";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listCohorts } from "@/features/onboarding/queries";
import {
  createCohort,
  updateCohort,
  deleteCohort,
  inviteCohortTrainee,
} from "@/features/onboarding/actions";
import { listAllChecklists } from "@/features/onboarding/checklist-queries";
import { toggleChecklistItem } from "@/features/onboarding/checklist-actions";
import { OPERATORS } from "@/features/auth/operators";
import type { CohortRow } from "@/features/onboarding/schemas";
import { onboardingGuideSections } from "./_content";
import { onboardingResources } from "./_resources";

/**
 * /dashboard/onboarding — 종합 페이지 (탭 3개).
 *
 * 1. 온보딩 가이드 — 정적 카드 그룹 (OPS-Console 컨텍스트)
 * 2. 회차 관리 — ListPattern variant=cohort 임베드. 신입(회차) 행 클릭 시
 *    인스펙터에서 그 신입의 체크리스트를 직접 표시·토글 (체크 상태는 cohort_id 기준).
 * 3. 자료실 — 사내 시스템/문서/매뉴얼 링크 큐레이션
 */
export default async function OnboardingPage() {
  const slug = "onboarding";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const isAdmin = me?.permission === "admin";

  const cohorts = await listCohorts();

  // 회차별 체크 상태 맵 — RLS가 사용자별 가시 범위로 스코프.
  // key 형식: `${section_key}::${item_key}` (가이드 섹션/항목 제목)
  const allChecks = await listAllChecklists();
  const checksByCohort = new Map<string, Record<string, boolean>>();
  for (const r of allChecks) {
    const m = checksByCohort.get(r.cohort_id) ?? {};
    m[`${r.section_key}::${r.item_key}`] = r.checked;
    checksByCohort.set(r.cohort_id, m);
  }

  const cohortRows: ListRow[] = cohorts.map((c) =>
    cohortToListRow(
      c,
      checksByCohort.get(c.id) ?? {},
      // 토글 권한: trainee 본인 || admin
      c.trainee_email === me?.email || isAdmin,
    ),
  );
  const config = resolvePageMeta(slug, meta, cohortRows.length);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  async function onCohortPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (isNew) {
      const result = await createCohort({
        title: row.name,
        trainee_email: row.traineeEmail ?? "",
        mentor_email: row.mentorEmail ?? null,
        start_date: row.startDate ?? new Date().toISOString().slice(0, 10),
        end_date: row.endDate ?? null,
        status: row.cohortStatus ?? "planned",
        notes: row.body ?? null,
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteCohort(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateCohort(row.id, {
      title: row.name,
      trainee_email: row.traineeEmail,
      mentor_email: row.mentorEmail ?? null,
      start_date: row.startDate,
      end_date: row.endDate ?? null,
      status: row.cohortStatus,
      notes: row.body ?? null,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  async function onInvite(
    cohortId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const result = await inviteCohortTrainee(cohortId);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  async function onChecklistToggle(input: {
    cohort_id: string;
    section_key: string;
    item_key: string;
    checked: boolean;
  }): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await toggleChecklistItem(input);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  const tabs: GuideTab[] = [
    {
      value: "guide",
      label: "온보딩 가이드",
      sections: onboardingGuideSections,
    },
    {
      value: "cohort",
      label: "회차 관리",
      children: (
        <ListPattern
          title="회차 관리"
          data={{ rows: cohortRows }}
          variant="cohort"
          canCreate={isAdmin}
          createLabel="+ 새 회차"
          readOnly={!isAdmin}
          onPersist={onCohortPersist}
          onInvite={isAdmin ? onInvite : undefined}
          onChecklistToggle={onChecklistToggle}
        />
      ),
    },
    {
      value: "resources",
      label: "자료실",
      sections: onboardingResources,
    },
  ];

  return <GuidePattern title={meta.label} header={header} tabs={tabs} />;
}

function cohortToListRow(
  c: CohortRow,
  checklistChecks: Record<string, boolean>,
  canToggleChecklist: boolean,
): ListRow {
  const trainee = OPERATORS.find((o) => o.email === c.trainee_email);
  const mentor = c.mentor_email
    ? OPERATORS.find((o) => o.email === c.mentor_email)
    : null;
  return {
    id: c.id,
    name: c.title,
    body: c.notes ?? undefined,
    status: "active",
    owner: mentor?.name ?? "",
    author: trainee?.name ?? c.trainee_email,
    traineeEmail: c.trainee_email,
    mentorEmail: c.mentor_email ?? null,
    startDate: c.start_date,
    endDate: c.end_date ?? null,
    cohortStatus: c.status,
    invitedAt: c.invited_at ?? null,
    acceptedAt: c.accepted_at ?? null,
    checklistChecks,
    canToggleChecklist,
  };
}
