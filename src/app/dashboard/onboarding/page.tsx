import { findSidebarMeta } from "../_data";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
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
} from "@/features/onboarding/actions";
import { OPERATORS } from "@/features/auth/operators";
import type { CohortRow } from "@/features/onboarding/schemas";
import { onboardingGuideSections } from "./_content";

/**
 * /dashboard/onboarding — 종합 페이지 (탭 4개).
 *
 * 1. 온보딩 가이드 — 정적 카드 그룹 (Folio 컨텍스트)
 * 2. 체크리스트 — 본인 진행도 (후속 PR-2)
 * 3. 회차 관리 — 기존 ListPattern variant=cohort 임베드 (admin only)
 * 4. 활동 로그 — placeholder (후속)
 */
export default async function OnboardingPage() {
  const slug = "onboarding";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? derivePageMeta(slug, meta);

  const cohorts = await listCohorts();
  const cohortRows: ListRow[] = cohorts.map(cohortToListRow);

  const me = await getCurrentOperator();
  const isAdmin = me?.permission === "admin";

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
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

  const tabs: GuideTab[] = [
    {
      value: "guide",
      label: "온보딩 가이드",
      sections: onboardingGuideSections,
    },
    {
      value: "checklist",
      label: "체크리스트",
      placeholder:
        "본인 회차의 진행도 체크리스트는 후속 PR에서 추가됩니다. 지금은 가이드 탭으로 학습 시작하세요.",
    },
    {
      value: "cohort",
      label: "회차 관리",
      children: (
        <ListPattern
          title=""
          data={{ rows: cohortRows }}
          variant="cohort"
          canCreate={isAdmin}
          createLabel="+ 새 회차"
          readOnly={!isAdmin}
          onPersist={onCohortPersist}
        />
      ),
    },
    {
      value: "log",
      label: "활동 로그",
      placeholder: "활동 로그 시스템은 후속 epic에서 추가됩니다.",
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
  };
}
