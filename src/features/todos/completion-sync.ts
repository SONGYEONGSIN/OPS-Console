import type { TodoStatus } from "./schemas";

/** 완료 동기화가 보는 필드만 — TodoCreate/TodoUpdate 모두 구조적으로 할당 가능. */
type CompletionPatch = {
  status?: TodoStatus | null;
  done?: boolean;
  done_at?: string | null;
};

/**
 * todo 변경 패치에서 상태값(status='done')과 완료 체크(done)를 양방향 동기화한다.
 *
 * - status가 지목되면 그것을 단일 진실로: done = (status==='done'), done_at 파생.
 * - status 없이 done만 지목되면: status = done ? 'done' : 'todo', done_at 파생.
 * - 둘 다 지목 + 모순이면 status 우선(상태값이 더 명시적 의미).
 * - 완료 시 done_at은 기존 값 보존, 없으면 nowIso. 미완료면 null.
 * - 완료 관련 키가 패치에 없으면 그대로 둔다(다른 필드만 수정하는 경우 불변).
 *
 * 불변 — 새 객체를 반환하고 입력을 변경하지 않는다.
 */
export function syncTodoCompletion<T extends CompletionPatch>(
  patch: T,
  nowIso: string,
): T & Partial<CompletionPatch> {
  const hasStatus = patch.status !== undefined && patch.status !== null;
  const hasDone = patch.done !== undefined;
  if (!hasStatus && !hasDone) return { ...patch };

  const isDone = hasStatus ? patch.status === "done" : !!patch.done;
  return {
    ...patch,
    done: isDone,
    status: (isDone ? "done" : hasStatus ? patch.status : "todo") as TodoStatus,
    done_at: isDone ? (patch.done_at ?? nowIso) : null,
  };
}
