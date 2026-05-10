import { findSidebarMeta } from "../_data";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
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

/**
 * /dashboard/onboarding — 신입 OJT 회차 관리 (DB 연동).
 * admin: 회차 CRUD / trainee·mentor: 본인 회차 read.
 * 세션(주차별 일정 그리드)은 후속 epic.
 */
export default async function OnboardingPage() {
  const slug = "onboarding";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? derivePageMeta(slug, meta);

  const cohorts = await listCohorts();
  const rows: ListRow[] = cohorts.map(cohortToListRow);

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

  async function onPersist(
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

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="cohort"
      canCreate={isAdmin}
      createLabel="+ 새 회차"
      readOnly={!isAdmin}
      onPersist={onPersist}
    />
  );
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
