import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLayout from "../layout";

describe("DashboardLayout — TitleBar 텍스트", () => {
  it("'운영부 · 상황실' 노출 (간소화된 단일 표기)", () => {
    render(
      <DashboardLayout>
        <div data-testid="page-body">child</div>
      </DashboardLayout>,
    );
    expect(screen.getAllByText(/운영부/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/상황실/).length).toBeGreaterThanOrEqual(1);
  });
});
