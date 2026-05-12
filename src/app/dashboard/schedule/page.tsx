import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listScheduleEvents } from "@/features/schedule/queries";
import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from "@/features/schedule/actions";
import { OPERATORS } from "@/features/auth/operators";
import type { ScheduleEventRow } from "@/features/schedule/schemas";

/**
 * /dashboard/schedule — 운영부 공통 일정 (DB 연동).
 * admin은 모든 일정 CRUD, member는 본인이 created_by 또는 assignee인 일정만 수정/삭제.
 */
export default async function SchedulePage() {
  const slug = "schedule";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const events = await listScheduleEvents();
  const rows: ListRow[] = events.map(eventToListRow);

  const me = await getCurrentOperator();
  const canWrite = me?.permission !== "viewer" && me?.permission !== null;

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const operator = await getCurrentOperator();
    if (isNew) {
      const result = await createScheduleEvent({
        type: row.scheduleType ?? "event",
        title: row.name,
        description: row.body ?? null,
        start_at: row.start_at ?? new Date().toISOString(),
        end_at: row.end_at ?? null,
        all_day: row.allDay ?? false,
        assignee_email: row.assigneeEmail ?? null,
        created_by_email: operator?.email ?? "",
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteScheduleEvent(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateScheduleEvent(row.id, {
      type: row.scheduleType,
      title: row.name,
      description: row.body ?? null,
      start_at: row.start_at,
      end_at: row.end_at ?? null,
      all_day: row.allDay ?? false,
      assignee_email: row.assigneeEmail ?? null,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="schedule"
      canCreate={canWrite}
      createLabel="+ 새 일정"
      readOnly={!canWrite}
      onPersist={onPersist}
    />
  );
}

function eventToListRow(ev: ScheduleEventRow): ListRow {
  const assignee = ev.assignee_email
    ? OPERATORS.find((o) => o.email === ev.assignee_email)
    : null;
  return {
    id: ev.id,
    name: ev.title,
    body: ev.description ?? undefined,
    status: "active",
    owner: assignee?.name ?? "",
    scheduleType: ev.type,
    start_at: ev.start_at,
    end_at: ev.end_at ?? null,
    allDay: ev.all_day,
    assigneeEmail: ev.assignee_email ?? null,
    createdByEmail: ev.created_by_email,
  };
}
