import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  requireMenu: vi.fn(),
  getRoundWithItems: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/features/auth/menu-guard", () => ({ requireMenu: h.requireMenu }));
vi.mock("@/features/checklist/queries", () => ({
  getRoundWithItems: h.getRoundWithItems,
}));
vi.mock("next/navigation", () => ({ notFound: h.notFound }));
vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./_components/ReportDocument", () => ({
  ReportDocument: () => <div data-testid="doc" />,
}));

import Page from "./page";

const round = {
  id: "r1",
  title: "t",
  periodStart: null,
  periodEnd: null,
  status: "active" as const,
  createdBy: null,
  createdAt: "2026-07-20T00:00:00Z",
  reportHtml: null,
  reportGeneratedAt: null,
};

describe("checklist report page", () => {
  it("회차 없으면 notFound", async () => {
    h.requireMenu.mockResolvedValue(undefined);
    h.getRoundWithItems.mockResolvedValue(null);
    await expect(
      Page({ params: Promise.resolve({ id: "x" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("회차 있으면 ReportDocument 렌더", async () => {
    h.requireMenu.mockResolvedValue(undefined);
    h.getRoundWithItems.mockResolvedValue({ round, items: [] });
    render(await Page({ params: Promise.resolve({ id: "r1" }) }));
    expect(screen.getByTestId("doc")).toBeTruthy();
  });
});
