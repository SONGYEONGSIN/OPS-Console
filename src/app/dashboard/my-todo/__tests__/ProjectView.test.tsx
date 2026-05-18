import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/dashboard/my-todo",
  useSearchParams: () => new URLSearchParams(),
}));

import { ProjectView } from "../ProjectView";

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
});
