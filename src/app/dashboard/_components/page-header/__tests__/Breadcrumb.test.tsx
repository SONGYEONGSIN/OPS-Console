import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "../Breadcrumb";

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarBreadcrumb: () => [
    { label: "개요" },
    { label: "서비스 그룹" },
    { label: "서비스" },
  ],
}));

describe("Breadcrumb", () => {
  it("crumbs 3개 + slash separator 2개 렌더", () => {
    render(<Breadcrumb pathname="/dashboard/services" />);
    expect(screen.getByText("개요")).toBeInTheDocument();
    expect(screen.getByText("서비스 그룹")).toBeInTheDocument();
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getAllByText("/")).toHaveLength(2);
  });
});
