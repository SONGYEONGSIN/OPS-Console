import { describe, it, expect } from "vitest";
import {
  projectPrioritySchema,
  projectStatusSchema,
  projectRowSchema,
  projectCreateSchema,
  projectUpdateSchema,
  projectTaskRowSchema,
  projectTaskCreateSchema,
  projectTaskUpdateSchema,
} from "../schemas";

describe("projectPrioritySchema / projectStatusSchema", () => {
  it.each(["low", "medium", "high"] as const)("priority %s 유효", (p) => {
    expect(projectPrioritySchema.parse(p)).toBe(p);
  });
  it.each(["todo", "in_progress", "done", "blocked"] as const)(
    "status %s 유효",
    (s) => {
      expect(projectStatusSchema.parse(s)).toBe(s);
    },
  );
  it("알 수 없는 priority — reject", () => {
    expect(() => projectPrioritySchema.parse("urgent")).toThrow();
  });
});

describe("projectRowSchema", () => {
  const validRow = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "신제품 프로모션",
    description: null,
    owner_email: "me@x.com",
    start_at: "2026-05-20",
    end_at: "2026-06-30",
    priority: "high" as const,
    progress: 30,
    status: "in_progress" as const,
    created_by_email: "me@x.com",
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
  };

  it("유효 row — parse 성공", () => {
    expect(projectRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("name 빈 — reject", () => {
    expect(projectRowSchema.safeParse({ ...validRow, name: "" }).success).toBe(
      false,
    );
  });

  it("progress 101 — reject", () => {
    expect(
      projectRowSchema.safeParse({ ...validRow, progress: 101 }).success,
    ).toBe(false);
  });

  it("start_at/end_at null 허용 (Gantt 미정)", () => {
    expect(
      projectRowSchema.safeParse({
        ...validRow,
        start_at: null,
        end_at: null,
      }).success,
    ).toBe(true);
  });

  it("owner_email 잘못된 형식 — reject", () => {
    expect(
      projectRowSchema.safeParse({ ...validRow, owner_email: "not-email" })
        .success,
    ).toBe(false);
  });
});

describe("projectCreateSchema", () => {
  it("name + owner_email + created_by_email 필수", () => {
    const ok = projectCreateSchema.safeParse({
      name: "프로젝트A",
      owner_email: "me@x.com",
      created_by_email: "me@x.com",
    });
    expect(ok.success).toBe(true);
  });

  it("priority/status 기본값 적용", () => {
    const parsed = projectCreateSchema.parse({
      name: "프로젝트A",
      owner_email: "me@x.com",
      created_by_email: "me@x.com",
    });
    expect(parsed.priority).toBe("medium");
    expect(parsed.status).toBe("todo");
    expect(parsed.progress).toBe(0);
  });

  it("name 빈 — reject", () => {
    expect(
      projectCreateSchema.safeParse({
        name: "",
        owner_email: "me@x.com",
        created_by_email: "me@x.com",
      }).success,
    ).toBe(false);
  });
});

describe("projectUpdateSchema", () => {
  it("부분 업데이트 — name만", () => {
    expect(projectUpdateSchema.parse({ name: "변경" }).name).toBe("변경");
  });

  it("progress만 토글", () => {
    expect(projectUpdateSchema.parse({ progress: 80 }).progress).toBe(80);
  });
});

describe("projectTaskRowSchema", () => {
  const validTask = {
    id: "22222222-2222-4222-8222-222222222222",
    project_id: "11111111-1111-4111-8111-111111111111",
    name: "블로그 포스팅",
    assignee_email: "me@x.com",
    start_at: "2026-05-22",
    end_at: "2026-05-23",
    priority: "medium" as const,
    progress: 50,
    status: "in_progress" as const,
    created_by_email: "me@x.com",
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
  };

  it("유효 task — parse 성공", () => {
    expect(projectTaskRowSchema.safeParse(validTask).success).toBe(true);
  });

  it("project_id uuid 아니면 — reject", () => {
    expect(
      projectTaskRowSchema.safeParse({ ...validTask, project_id: "bad" })
        .success,
    ).toBe(false);
  });

  it("assignee_email nullable", () => {
    expect(
      projectTaskRowSchema.safeParse({ ...validTask, assignee_email: null })
        .success,
    ).toBe(true);
  });

  it("parent_task_id 필드 — 스키마에 없음 (1단계 enforcement)", () => {
    const withParent = { ...validTask, parent_task_id: "ghost" };
    // strict 모드 아니라 unknown key는 ignore. but check that parsed object don't have it
    const parsed = projectTaskRowSchema.parse(withParent);
    expect(
      Object.prototype.hasOwnProperty.call(parsed, "parent_task_id"),
    ).toBe(false);
  });
});

describe("projectTaskCreateSchema / projectTaskUpdateSchema", () => {
  it("Create — project_id + name + created_by_email 필수", () => {
    expect(
      projectTaskCreateSchema.safeParse({
        project_id: "11111111-1111-4111-8111-111111111111",
        name: "task1",
        created_by_email: "me@x.com",
      }).success,
    ).toBe(true);
  });

  it("Update — progress만 부분 갱신", () => {
    expect(projectTaskUpdateSchema.parse({ progress: 100 }).progress).toBe(100);
  });
});
