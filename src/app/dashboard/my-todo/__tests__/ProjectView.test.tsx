import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/dashboard/my-todo",
  useSearchParams: () => new URLSearchParams(),
}));

import { ProjectView, resolveEffectiveProjectId } from "../ProjectView";
import type { ProjectRow, ProjectTaskRow } from "@/features/projects/schemas";

const project: ProjectRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "테스트 프로젝트",
  description: null,
  owner_email: "alcure23@jinhakapply.com",
  start_at: null,
  end_at: null,
  priority: "high",
  progress: 50,
  status: "in_progress",
  created_by_email: "ys1114@jinhakapply.com",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

const task: ProjectTaskRow = {
  id: "22222222-2222-2222-2222-222222222222",
  project_id: project.id,
  name: "테스트 업무",
  assignee_email: "ys1114@jinhakapply.com",
  start_at: null,
  end_at: null,
  priority: "high",
  progress: 50,
  status: "in_progress",
  checklist: [],
  created_by_email: "ys1114@jinhakapply.com",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("ProjectView", () => {
  it("프로젝트 없음 — 안내 텍스트", () => {
    render(
      <ProjectView
        projectsWithTasks={[]}
        canWrite={true}
        onPersistProject={vi.fn(async () => ({ ok: true }))}
        onPersistTask={vi.fn(async () => ({ ok: true }))}
      />,
    );
    expect(screen.getByText(/프로젝트 없음/)).toBeInTheDocument();
  });

  it("담당 — 이메일 id가 아닌 운영자 이름으로 표시 (프로젝트/하위 업무)", () => {
    render(
      <ProjectView
        projectsWithTasks={[{ project, tasks: [task] }]}
        canWrite={true}
        onPersistProject={vi.fn(async () => ({ ok: true }))}
        onPersistTask={vi.fn(async () => ({ ok: true }))}
      />,
    );
    // 프로젝트 담당: owner_email(허승철) — "본인"이 아닌 실제 이름
    expect(screen.getByText("허승철")).toBeInTheDocument();
    expect(screen.queryByText("본인")).not.toBeInTheDocument();
    // 하위 업무 담당: assignee_email(송영신)
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.queryByText("alcure23")).not.toBeInTheDocument();
    expect(screen.queryByText("ys1114")).not.toBeInTheDocument();
  });
});

describe("resolveEffectiveProjectId", () => {
  const pwt = [{ project, tasks: [] }];

  it("선택 id가 목록에 존재 → 그대로 반환", () => {
    expect(resolveEffectiveProjectId(project.id, pwt)).toBe(project.id);
  });

  it("선택 id가 목록에 없음(삭제됨) → 첫 프로젝트로 폴백", () => {
    const stale = "99999999-9999-9999-9999-999999999999";
    expect(resolveEffectiveProjectId(stale, pwt)).toBe(project.id);
  });

  it("선택 id null → 첫 프로젝트로 폴백", () => {
    expect(resolveEffectiveProjectId(null, pwt)).toBe(project.id);
  });

  it("프로젝트 목록이 비면 → null", () => {
    expect(resolveEffectiveProjectId(project.id, [])).toBeNull();
  });
});
