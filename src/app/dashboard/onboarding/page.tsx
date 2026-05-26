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
import { listChecklistByCohort } from "@/features/onboarding/checklist-queries";
import { toggleChecklistItem } from "@/features/onboarding/checklist-actions";
import { OPERATORS } from "@/features/auth/operators";
import type { CohortRow } from "@/features/onboarding/schemas";
import { onboardingGuideSections } from "./_content";
import { onboardingResources } from "./_resources";
import { ChecklistTab } from "./ChecklistTab";

/**
 * /dashboard/onboarding — 종합 페이지 (탭 4개).
 *
 * 1. 온보딩 가이드 — 정적 카드 그룹 (OPS-Console 컨텍스트)
 * 2. 체크리스트 — 본인 진행도 (가이드 항목과 자동 매핑)
 * 3. 회차 관리 — 기존 ListPattern variant=cohort 임베드 (admin only)
 * 4. 자료실 — 사내 시스템/문서/매뉴얼 링크 큐레이션
 */
type SearchParams = { tab?: string; cohort?: string };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "onboarding";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const cohorts = await listCohorts();
  const cohortRows: ListRow[] = cohorts.map(cohortToListRow);
  const config = resolvePageMeta(slug, meta, cohortRows.length);

  const me = await getCurrentOperator();
  const isAdmin = me?.permission === "admin";
  const params = await searchParams;

  // 권한별 체크리스트 cohort 후보:
  //  - admin: 모든 cohort
  //  - 본인이 trainee인 cohort (1개)
  //  - 본인이 mentor인 cohort들 (read-only)
  const visibleCohorts = isAdmin
    ? cohorts
    : cohorts.filter(
        (c) =>
          c.trainee_email === me?.email || c.mentor_email === me?.email,
      );

  // 초기 선택: URL ?cohort → 그 다음 본인 trainee cohort → 첫 visible cohort
  const myTraineeCohort = me?.email
    ? (visibleCohorts.find((c) => c.trainee_email === me.email) ?? null)
    : null;
  const selectedCohort =
    (params.cohort &&
      visibleCohorts.find((c) => c.id === params.cohort)) ||
    myTraineeCohort ||
    visibleCohorts[0] ||
    null;

  const checklistRows = selectedCohort
    ? await listChecklistByCohort(selectedCohort.id)
    : [];
  const initialChecks: Record<string, boolean> = {};
  for (const r of checklistRows) {
    initialChecks[`${r.section_key}::${r.item_key}`] = r.checked;
  }

  // 토글 권한: 선택된 cohort 기준 trainee 본인 || admin
  const canToggleChecklist = Boolean(
    selectedCohort &&
      (selectedCohort.trainee_email === me?.email || isAdmin),
  );

  const cohortOptions = visibleCohorts.map((c) => {
    const trainee = OPERATORS.find((o) => o.email === c.trainee_email);
    return {
      id: c.id,
      title: `${c.title} — ${trainee?.name ?? c.trainee_email}`,
    };
  });

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
      value: "checklist",
      label: "체크리스트",
      children: (
        <ChecklistTab
          sections={onboardingGuideSections}
          cohorts={cohortOptions}
          selectedCohortId={selectedCohort?.id ?? null}
          initialChecks={initialChecks}
          canToggle={canToggleChecklist}
          onToggle={onChecklistToggle}
        />
      ),
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

function cohortToListRow(c: CohortRow): ListRow {
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
  };
}
