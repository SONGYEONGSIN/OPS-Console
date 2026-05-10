import { describe, it, expect } from "vitest";
import {
  todoPrioritySchema,
  todoCreateSchema,
  todoRowSchema,
  todoUpdateSchema,
} from "../schemas";

describe("todo priority enum", () => {
  it.each(["low", "medium", "high"] as const)("%s — 유효", (p) => {
    expect(todoPrioritySchema.parse(p)).toBe(p);
  });

  it("알 수 없는 priority — reject", () => {
    expect(() => todoPrioritySchema.parse("urgent")).toThrow();
  });
});

describe("todoCreateSchema", () => {
  const valid = {
    title: "운영 회의 자료 정리",
    body: "오늘 17시까지",
    priority: "high" as const,
    due_at: "2026-05-15T08:00:00Z",
    assignee_email: "ys1114@jinhakapply.com",
    created_by_email: "ys1114@jinhakapply.com",
  };

  it("유효 입력 — parse 성공", () => {
    expect(todoCreateSchema.parse(valid).title).toBe(valid.title);
  });

  it("title 빈 — reject", () => {
    expect(() => todoCreateSchema.parse({ ...valid, title: "" })).toThrow();
  });

  it("priority 생략 — default 'medium'", () => {
    const { priority: _omit, ...rest } = valid;
    expect(todoCreateSchema.parse(rest).priority).toBe("medium");
  });

  it("due_at 생략 — 허용 (마감 미정)", () => {
    const { due_at: _omit, ...rest } = valid;
    expect(todoCreateSchema.parse(rest).due_at ?? null).toBeNull();
  });

  it("assignee_email 잘못된 형식 — reject", () => {
    expect(() =>
      todoCreateSchema.parse({ ...valid, assignee_email: "x" }),
    ).toThrow();
  });
});

describe("todoRowSchema", () => {
  it("DB row 형식 parse", () => {
    const row = {
      id: "a1b2c3d4-1234-4567-89ab-123456789012",
      title: "할 일 1",
      body: null,
      done: false,
      done_at: null,
      due_at: null,
      priority: "medium" as const,
      assignee_email: "ys1114@jinhakapply.com",
      created_by_email: "ys1114@jinhakapply.com",
      created_at: "2026-05-10T15:00:00Z",
      updated_at: "2026-05-10T15:00:00Z",
    };
    expect(todoRowSchema.parse(row).id).toBe(row.id);
  });

  it("done=true 시 done_at 있음 — parse OK", () => {
    const row = {
      id: "a1b2c3d4-1234-4567-89ab-123456789012",
      title: "완료된 일",
      body: null,
      done: true,
      done_at: "2026-05-10T16:00:00Z",
      due_at: null,
      priority: "low" as const,
      assignee_email: "ys1114@jinhakapply.com",
      created_by_email: "ys1114@jinhakapply.com",
      created_at: "2026-05-10T15:00:00Z",
      updated_at: "2026-05-10T16:00:00Z",
    };
    expect(todoRowSchema.parse(row).done).toBe(true);
  });
});

describe("todoUpdateSchema", () => {
  it("부분 업데이트 — title만", () => {
    expect(todoUpdateSchema.parse({ title: "변경" }).title).toBe("변경");
  });

  it("done만 토글", () => {
    expect(todoUpdateSchema.parse({ done: true }).done).toBe(true);
  });

  it("priority만 변경", () => {
    expect(todoUpdateSchema.parse({ priority: "high" }).priority).toBe("high");
  });
});
