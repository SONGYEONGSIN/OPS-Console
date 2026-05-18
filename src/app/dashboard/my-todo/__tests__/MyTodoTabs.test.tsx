import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyTodoTabs } from "../MyTodoTabs";

describe("MyTodoTabs", () => {
  it("activeTab 'weekly' — weeklyContent 렌더", () => {
    render(
      <MyTodoTabs
        activeTab="weekly"
        weeklyContent={<div>weekly body</div>}
        projectContent={<div>project body</div>}
      />,
    );
    expect(screen.getByText("weekly body")).toBeInTheDocument();
    expect(screen.queryByText("project body")).toBeNull();
  });

  it("activeTab 'project' — projectContent 렌더", () => {
    render(
      <MyTodoTabs
        activeTab="project"
        weeklyContent={<div>weekly body</div>}
        projectContent={<div>project body</div>}
      />,
    );
    expect(screen.getByText("project body")).toBeInTheDocument();
  });

  it("탭 Link href — weekly는 '/dashboard/my-todo', project는 '?tab=project'", () => {
    render(
      <MyTodoTabs
        activeTab="weekly"
        weeklyContent={<div />}
        projectContent={<div />}
      />,
    );
    const weeklyTab = screen.getByRole("tab", { name: "원서접수" });
    const projectTab = screen.getByRole("tab", { name: "프로젝트" });
    expect(weeklyTab).toHaveAttribute("href", "/dashboard/my-todo");
    expect(projectTab).toHaveAttribute(
      "href",
      "/dashboard/my-todo?tab=project",
    );
  });

  it("activeTab 'project' — projectTab aria-current='page'", () => {
    render(
      <MyTodoTabs
        activeTab="project"
        weeklyContent={<div />}
        projectContent={<div />}
      />,
    );
    expect(screen.getByRole("tab", { name: "프로젝트" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("tab", { name: "원서접수" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
