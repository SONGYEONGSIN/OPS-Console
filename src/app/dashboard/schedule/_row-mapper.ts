import type { ListRow } from "../_components/patterns/ListPattern";
import type { ScheduleEventRow } from "@/features/schedule/schemas";
import { OPERATORS } from "@/features/auth/operators";

export function eventToListRow(ev: ScheduleEventRow): ListRow {
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
