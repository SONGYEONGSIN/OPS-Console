import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../PageHeader";

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarBreadcrumb: () => [{ label: "개요" }, { label: "새 알림" }],
  findSidebarSiblings: () => [],
}));

describe("PageHeader", () => {
  it("Breadcrumb + PageMeta + PageHeadline 모두 렌더", () => {
    render(
      <PageHeader
        pathname="/dashboard/alerts"
        meta={[{ label: "오늘", tone: "accent" }]}
        headline={{ accent: "지금", title: "주의" }}
        description="설명문"
      />,
    );
    expect(screen.getByText("개요")).toBeInTheDocument();
    expect(screen.getByText("오늘")).toBeInTheDocument();
    expect(screen.getByText("지금")).toBeInTheDocument();
    expect(screen.getByText("주의")).toBeInTheDocument();
    expect(screen.getByText("설명문")).toBeInTheDocument();
  });
});
