import type { ServicesRow } from "@/features/services/schemas";
import type { TodoCreate, TodoRow } from "./schemas";

/** 원서접수 자동 등록 카테고리 라벨 — 수동 drag&drop 경로(WeeklyView)와 동일. */
export const APPLICATION_CATEGORY = "원서접수";

/**
 * 2주 범위 원서접수 services 중 아직 todo로 등록되지 않은 것을 골라 create payload[]를 만든다.
 *
 * 멱등 핵심: 기존 todo가 같은 source_service_id로 연결돼 있으면(완료/미완/삭제됨 auto_dismissed 무관)
 * 건너뛴다 → 사용자가 지운 항목을 재생성하지 않는다(삭제 존중).
 * write_start_at 없는 service는 due_at을 정할 수 없어 제외.
 *
 * 본인 담당 필터·-1년/+1년 shift는 호출부(page/action)에서 끝낸 services를 받는다(순수 함수는 가공 안 함).
 */
export function computeMissingApplicationTodos(
  services: ServicesRow[],
  existingTodos: Pick<TodoRow, "source_service_id">[],
  meEmail: string,
): TodoCreate[] {
  const linked = new Set(
    existingTodos
      .map((t) => t.source_service_id)
      .filter((id): id is string => !!id),
  );

  const out: TodoCreate[] = [];
  for (const s of services) {
    if (!s.write_start_at) continue;
    if (linked.has(s.id)) continue;
    out.push({
      title: `${s.university_name} - ${s.service_name}`,
      category: APPLICATION_CATEGORY,
      due_at: s.write_start_at,
      source_service_id: s.id,
      status: "todo",
      priority: "medium",
      assignee_email: meEmail,
      created_by_email: meEmail,
    });
  }
  return out;
}
