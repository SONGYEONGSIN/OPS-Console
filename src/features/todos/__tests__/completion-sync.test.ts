import { describe, it, expect } from "vitest";
import { syncTodoCompletion } from "../completion-sync";
import type { TodoUpdate } from "../schemas";

const NOW = "2026-06-22T06:00:00.000Z";

describe("syncTodoCompletion — status(done) ↔ done 체크 동기화", () => {
  it("status='done' → done=true + done_at 설정", () => {
    const r = syncTodoCompletion({ status: "done" }, NOW);
    expect(r.done).toBe(true);
    expect(r.done_at).toBe(NOW);
    expect(r.status).toBe("done");
  });

  it("status='todo' → done=false + done_at=null", () => {
    const r = syncTodoCompletion({ status: "todo" }, NOW);
    expect(r.done).toBe(false);
    expect(r.done_at).toBeNull();
  });

  it("status='in_progress' → done=false", () => {
    const r = syncTodoCompletion({ status: "in_progress" }, NOW);
    expect(r.done).toBe(false);
    expect(r.done_at).toBeNull();
  });

  it("done=true (status 없음) → status='done' + done_at", () => {
    const r = syncTodoCompletion({ done: true }, NOW);
    expect(r.status).toBe("done");
    expect(r.done).toBe(true);
    expect(r.done_at).toBe(NOW);
  });

  it("done=false (status 없음) → status='todo' + done_at=null", () => {
    const r = syncTodoCompletion({ done: false }, NOW);
    expect(r.status).toBe("todo");
    expect(r.done).toBe(false);
    expect(r.done_at).toBeNull();
  });

  it("모순(status='done' & done=false) → status 우선 → done=true", () => {
    const r = syncTodoCompletion({ status: "done", done: false }, NOW);
    expect(r.done).toBe(true);
    expect(r.status).toBe("done");
    expect(r.done_at).toBe(NOW);
  });

  it("이미 done_at 있으면 보존(재완료 시 시각 유지)", () => {
    const prev = "2026-06-01T00:00:00.000Z";
    const r = syncTodoCompletion({ status: "done", done_at: prev }, NOW);
    expect(r.done_at).toBe(prev);
  });

  it("status/done 둘 다 없으면 다른 필드는 그대로(완료 관련 키 미추가)", () => {
    const patch: TodoUpdate = { title: "수정" };
    const r = syncTodoCompletion(patch, NOW);
    expect(r).toEqual({ title: "수정" });
    expect("done" in r).toBe(false);
    expect("status" in r).toBe(false);
  });

  it("원본 객체를 변경하지 않는다(불변)", () => {
    const patch = { status: "done" as const };
    syncTodoCompletion(patch, NOW);
    expect(patch).toEqual({ status: "done" });
  });
});
